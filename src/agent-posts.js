/**
 * Agent posts — posts written by the SMM agents (repo dilshodustoz/smm-agents)
 * go through the same 21:00 review as every other post.
 *
 * The agents' scheduled task copies posts the Muharrir approved into
 * content/agent-queue.json:
 *
 *   { "posts": [ { "id": "ig1", "date": "2026-11-16", "time": "18:00",
 *                  "channel": "tg_english" | "tg_multilevel" | "ig_ustoz",
 *                  "format": "post" | "carousel" | "reels",
 *                  "caption": "HTML text", "images": ["https://… or repo/path.png"],
 *                  "rev": 1 } ] }
 *
 *   21:00  review.js preview shows tomorrow's agent posts with ✅ / ❌ / ✏️.
 *          ✏️ asks the admin what to change and saves the answer on the draft
 *          (status "edit_requested", draft.edit_request); the agents rewrite
 *          the post (rev + 1) and start review.yml preview for that slot again.
 *   time   Telegram posts: the listener posts approved ones (publishDueAgentPosts).
 *          Instagram posts are not posted by this bot: the agents' task reads
 *          approved ig_ustoz drafts from content/review.json and publishes them
 *          through the Instagram Graph API.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { callApi, sendLocalPhoto, setTargetChat } from './telegram.js';
import { MULTILEVEL_CHANNEL_ID } from './multilevel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const QUEUE_FILE = join(ROOT, 'content', 'agent-queue.json');

const CHANNELS = {
  tg_english: { label: '🤖 Agent · @dilshod_english', chat: () => process.env.TELEGRAM_CHANNEL_ID },
  tg_multilevel: { label: '🤖 Agent · @dilshod_multilevel', chat: () => MULTILEVEL_CHANNEL_ID },
  ig_ustoz: { label: '📸 Agent · Instagram @dilshod.ustoz', chat: null },
};

const CAPTION_LIMIT = 1024;

export function loadQueue() {
  if (!existsSync(QUEUE_FILE)) return [];
  const data = JSON.parse(readFileSync(QUEUE_FILE, 'utf-8'));
  return Array.isArray(data.posts) ? data.posts : [];
}

/** A queue entry is usable when it has the fields the review needs. */
export function validPost(post) {
  return Boolean(
    post && /^[\w-]{1,20}$/.test(post.id || '') && /^\d{4}-\d{2}-\d{2}$/.test(post.date || '')
      && /^\d{2}:\d{2}$/.test(post.time || '') && CHANNELS[post.channel] && (post.caption || post.images?.length),
  );
}

export function agentSlot(post) {
  return `${post.time} ${post.id}`;
}

export function isAgentDraft(draft) {
  return Boolean(draft?.meta?.agent_id);
}

function isUrl(path) {
  return /^https?:\/\//.test(path);
}

function localPath(path) {
  return isAbsolute(path) ? path : join(ROOT, path);
}

/** Send one picture (URL or file in the repo) to the current target chat. */
async function sendOnePhoto(chatId, path, caption) {
  if (isUrl(path)) {
    return callApi('sendPhoto', { chat_id: chatId, photo: path, caption, parse_mode: 'HTML' });
  }
  setTargetChat(chatId);
  return sendLocalPhoto(localPath(path), caption);
}

/**
 * Show a post in a chat exactly as it will look. Returns what is needed to
 * post the same thing to the channel later (Telegram file ids).
 */
async function render(chatId, post) {
  const caption = post.caption || '';
  const images = post.images || [];
  const shortCaption = caption.length <= CAPTION_LIMIT;
  if (!images.length) {
    await callApi('sendMessage', { chat_id: chatId, text: caption, parse_mode: 'HTML', disable_web_page_preview: true });
    return { photos: [] };
  }
  const photos = [];
  if (images.length === 1) {
    const sent = await sendOnePhoto(chatId, images[0], shortCaption ? caption : '');
    photos.push(sent.photo?.at(-1)?.file_id || images[0]);
  } else {
    // Album (carousel): URLs go straight in, repo files one by one first to get their ids
    const media = [];
    for (const path of images.slice(0, 10)) {
      if (isUrl(path)) media.push(path);
      else {
        const sent = await sendOnePhoto(chatId, path, '');
        media.push(sent.photo?.at(-1)?.file_id);
      }
    }
    const result = await callApi('sendMediaGroup', {
      chat_id: chatId,
      media: media.map((m, i) => ({ type: 'photo', media: m, ...(i === 0 && shortCaption ? { caption, parse_mode: 'HTML' } : {}) })),
    });
    for (const message of result) photos.push(message.photo?.at(-1)?.file_id);
  }
  if (!shortCaption) {
    await callApi('sendMessage', { chat_id: chatId, text: caption, parse_mode: 'HTML', disable_web_page_preview: true });
  }
  return { photos };
}

/** 21:00: tomorrow's agent posts for the review. `only` = one slot ("18:00 ig1"). */
export function prepareAgentDrafts(date, adminId, only = '') {
  return loadQueue()
    .filter((post) => post.date === date && validPost(post))
    .filter((post) => !only || only === agentSlot(post))
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((post) => {
      const channel = CHANNELS[post.channel];
      const meta = { agent_id: post.id, channel: post.channel, format: post.format || 'post', rev: post.rev || 1 };
      const rev = meta.rev > 1 ? ` · ${meta.rev}-variant` : '';
      return {
        slot: agentSlot(post),
        label: `${channel.label}${post.format ? ` · ${post.format}` : ''}${rev}`,
        meta,
        send: async () => {
          const shown = await render(adminId, post);
          meta.photos = shown.photos;
          meta.caption = post.caption || '';
        },
      };
    });
}

/** Post an approved Telegram agent draft to its channel. */
export async function publishAgentDraft(draft) {
  const channel = CHANNELS[draft.meta.channel];
  if (!channel?.chat) throw new Error(`Not a Telegram post: ${draft.meta.channel}`);
  const chatId = channel.chat();
  const caption = draft.meta.caption || '';
  const photos = (draft.meta.photos || []).filter(Boolean);
  const shortCaption = caption.length <= CAPTION_LIMIT;
  if (!photos.length) {
    await callApi('sendMessage', { chat_id: chatId, text: caption, parse_mode: 'HTML', disable_web_page_preview: true });
    return;
  }
  if (photos.length === 1) {
    await callApi('sendPhoto', { chat_id: chatId, photo: photos[0], caption: shortCaption ? caption : '', parse_mode: 'HTML' });
  } else {
    await callApi('sendMediaGroup', {
      chat_id: chatId,
      media: photos.map((p, i) => ({ type: 'photo', media: p, ...(i === 0 && shortCaption ? { caption, parse_mode: 'HTML' } : {}) })),
    });
  }
  if (!shortCaption) await callApi('sendMessage', { chat_id: chatId, text: caption, parse_mode: 'HTML', disable_web_page_preview: true });
}

/** Telegram agent drafts for `date` whose time has come (Tashkent minutes since midnight). */
export function dueAgentKeys(state, date, nowMinutes) {
  return Object.entries(state.drafts)
    .filter(([key, d]) => key.startsWith(`${date} `) && isAgentDraft(d) && CHANNELS[d.meta.channel]?.chat)
    .filter(([, d]) => {
      const [h, m] = d.slot.split(' ')[0].split(':').map(Number);
      return h * 60 + m <= nowMinutes;
    })
    .map(([key]) => key);
}
