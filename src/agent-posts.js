/**
 * Agent posts — posts written by the SMM agents (repo dilshodustoz/smm-agents)
 * go through the same 21:00 review as every other post.
 *
 * The agents' scheduled task copies posts the Muharrir approved into
 * content/agent-queue.json:
 *
 *   { "posts": [ { "id": "ig1", "date": "2026-11-16", "time": "18:00",
 *                  "channel": "tg_english" | "tg_multilevel" | "ig_ustoz" | "ig_story",
 *                  "format": "post" | "carousel" | "reels",
 *                  "caption": "HTML text", "images": ["https://… or repo/path.png"],
 *                  "rev": 1 } ] }
 *
 *   Telegram posts may also carry "video": "content/agent-media/x.mp4" (sent
 *   instead of pictures, caption under it) and "button": { "text": "...",
 *   "url": "https://t.me/..." } (one link button under the post).
 *
 *   21:00  review.js preview shows tomorrow's agent posts with ✅ / ❌ / ✏️.
 *          ✏️ asks the admin what to change and saves the answer on the draft
 *          (status "edit_requested", draft.edit_request); the agents rewrite
 *          the post (rev + 1) and start review.yml preview for that slot again.
 *   time   Telegram posts: the listener posts approved ones (publishDueAgentPosts).
 *          Instagram posts: the listener hands approved ones to the mock site
 *          (POST /api/x/media for repo pictures, then POST /api/x/ig), which
 *          publishes them to Instagram (publishInstagramDraft). Needs the
 *          SMM_KEY secret; without it Instagram drafts are left untouched.
 *          Instagram stories (ig_story): the approved picture is sent to the
 *          admin as a file at its time, ready to share to the story by hand
 *          (deliverStoryDraft); "caption" is the note shown with it (sticker, link).
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { callApi, sendLocalPhoto, sendDocument, setTargetChat } from './telegram.js';
import { MULTILEVEL_CHANNEL_ID } from './multilevel.js';
import { isReelPost, isReelDraft, showReel, attachVoice, sendVideo } from './agent-reels.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const QUEUE_FILE = join(ROOT, 'content', 'agent-queue.json');

const CHANNELS = {
  tg_english: { label: '🤖 Agent · @dilshod_english', chat: () => process.env.TELEGRAM_CHANNEL_ID },
  tg_multilevel: { label: '🤖 Agent · @dilshod_multilevel', chat: () => MULTILEVEL_CHANNEL_ID },
  ig_ustoz: { label: '📸 Agent · Instagram @dilshod.ustoz', chat: null },
  ig_story: { label: '📱 Agent · Instagram story (tayyor fayl sizga keladi)', chat: null },
};

const CAPTION_LIMIT = 1024;
const SITE = (process.env.MOCK_SITE_URL || 'https://mock.dilshodustoz.workers.dev').replace(/\/+$/, '');
const IG_KINDS = { post: 'image', image: 'image', carousel: 'carousel' };

export function loadQueue() {
  if (!existsSync(QUEUE_FILE)) return [];
  const data = JSON.parse(readFileSync(QUEUE_FILE, 'utf-8'));
  return Array.isArray(data.posts) ? data.posts : [];
}

/** A queue entry is usable when it has the fields the review needs. */
export function validPost(post) {
  return Boolean(
    post && /^[\w-]{1,20}$/.test(post.id || '') && /^\d{4}-\d{2}-\d{2}$/.test(post.date || '')
      && /^\d{2}:\d{2}$/.test(post.time || '') && CHANNELS[post.channel] && (post.caption || post.images?.length)
      && (!isReelPost(post) || /\.mp4$/i.test(post.video || '')),
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

/** One link button under a Telegram post, or nothing. */
function linkButton(button) {
  if (!button?.text || !/^https:\/\//.test(button.url || '')) return null;
  return { inline_keyboard: [[{ text: String(button.text).slice(0, 60), url: button.url }]] };
}

/**
 * Show a post in a chat exactly as it will look. Returns what is needed to
 * post the same thing to the channel later (Telegram file ids).
 */
async function render(chatId, post) {
  const caption = post.caption || '';
  const images = post.images || [];
  const shortCaption = caption.length <= CAPTION_LIMIT;
  const markup = linkButton(post.button);
  if (post.video) {
    const sent = await sendVideo(chatId, localPath(post.video), shortCaption ? caption : '', markup);
    if (!shortCaption) await callApi('sendMessage', { chat_id: chatId, text: caption, parse_mode: 'HTML', disable_web_page_preview: true });
    return { photos: [], video_id: sent.video?.file_id };
  }
  if (!images.length) {
    await callApi('sendMessage', { chat_id: chatId, text: caption, parse_mode: 'HTML', disable_web_page_preview: true, ...(markup ? { reply_markup: markup } : {}) });
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
      const meta = { agent_id: post.id, channel: post.channel, format: post.format || 'post', rev: post.rev || 1, images: post.images || [] };
      if (isReelPost(post)) { meta.video = post.video; meta.script = post.script || ''; meta.segments = Array.isArray(post.segments) ? post.segments : []; }
      const rev = meta.rev > 1 ? ` · ${meta.rev}-variant` : '';
      return {
        slot: agentSlot(post),
        label: `${channel.label}${post.format ? ` · ${post.format}` : ''}${rev}`,
        meta,
        send: async () => {
          meta.caption = post.caption || '';
          if (isReelPost(post)) {
            meta.voice_prompt_id = await showReel(callApi, adminId, post, localPath(post.video));
            return;
          }
          const shown = await render(adminId, post);
          meta.photos = shown.photos;
          if (shown.video_id) meta.video_id = shown.video_id;
          if (post.button) meta.button = post.button;
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
  const markup = linkButton(draft.meta.button);
  if (draft.meta.video_id) {
    await callApi('sendVideo', { chat_id: chatId, video: draft.meta.video_id, caption: shortCaption ? caption : '', parse_mode: 'HTML', supports_streaming: true, ...(markup ? { reply_markup: markup } : {}) });
    if (!shortCaption) await callApi('sendMessage', { chat_id: chatId, text: caption, parse_mode: 'HTML', disable_web_page_preview: true });
    return;
  }
  if (!photos.length) {
    await callApi('sendMessage', { chat_id: chatId, text: caption, parse_mode: 'HTML', disable_web_page_preview: true, ...(markup ? { reply_markup: markup } : {}) });
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

export function isInstagramDraft(draft) {
  return draft?.meta?.channel === 'ig_ustoz';
}

export function isStoryDraft(draft) {
  return draft?.meta?.channel === 'ig_story';
}

/**
 * Send an approved story to the admin as files (full quality, not compressed
 * like a photo), with the note on what to add when sharing it.
 */
export async function deliverStoryDraft(draft, adminId) {
  const images = (draft.meta.images || []).filter((path) => !isUrl(path));
  if (!images.length) throw new Error('a story needs a picture file in the repo');
  const note = plainCaption(draft.meta.caption);
  setTargetChat(adminId);
  try {
    for (const [i, path] of images.entries()) {
      const caption = i === 0
        ? `📱 <b>Story tayyor</b>\nFaylni saqlang va Instagram story'ga qo'ying.${note ? `\n\n${note.replace(/&/g, '&amp;').replace(/</g, '&lt;')}` : ''}`.slice(0, CAPTION_LIMIT)
        : '';
      await sendDocument(localPath(path), path.split('/').pop(), caption);
    }
  } finally {
    setTargetChat(process.env.TELEGRAM_CHANNEL_ID);
  }
}

/** True when this bot can hand Instagram posts to the mock site. */
export function instagramReady() {
  return Boolean(process.env.SMM_KEY);
}

/** Store a file on the mock site (30 days) and return its public URL. */
async function uploadMedia(path, name, type) {
  const upload = await siteCall('/api/x/media', {
    method: 'POST',
    headers: { 'Content-Type': type, 'X-Name': name },
    body: readFileSync(path),
  });
  if (!upload.data.ok) throw new Error(`upload failed (${upload.status}): ${upload.data.error || '?'}`);
  return upload.data.url;
}

/**
 * A voice message from the admin for an open reel draft: the one whose script
 * message it answers, otherwise the only open reel. Returns the draft key or null.
 */
export function reelForVoice(state, message) {
  const open = Object.entries(state.drafts).filter(([, d]) => isReelDraft(d) && ['pending', 'approved'].includes(d.status));
  const replied = message.reply_to_message?.message_id;
  const hit = open.find(([, d]) => replied && d.meta.voice_prompt_id === replied);
  if (hit) return hit[0];
  return open.length === 1 ? open[0][0] : null;
}

export async function addVoiceToReel(draft, voice, adminId) {
  if (!instagramReady()) throw new Error('SMM_KEY secret is not set');
  await attachVoice(callApi, adminId, draft, voice, localPath(draft.meta.video), (path, name) => uploadMedia(path, name, 'video/mp4'));
}

async function siteCall(path, options) {
  const response = await fetch(`${SITE}${path}`, {
    ...options,
    headers: { 'X-Agent-Key': process.env.SMM_KEY, ...options.headers },
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

/** Instagram captions are plain text: drop the HTML the Telegram preview understands. */
export function plainCaption(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .trim();
}

/**
 * Hand an approved Instagram draft to the mock site's Instagram queue.
 * `ref` makes a second call for the same post a no-op (the site answers 409).
 */
export async function publishInstagramDraft(draft, date) {
  if (!instagramReady()) throw new Error('SMM_KEY secret is not set');
  if (isReelDraft(draft)) {
    // with the teacher's voice if one was sent, otherwise the silent subtitled reel
    const video = draft.meta.video_url || await uploadMedia(localPath(draft.meta.video), draft.meta.video.split('/').pop(), 'video/mp4');
    const queuedReel = await siteCall('/api/x/ig', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `${date}-${draft.meta.agent_id}-r${draft.meta.rev || 1}`, kind: 'reels', caption: plainCaption(draft.meta.caption), video_url: video }),
    });
    if (queuedReel.status !== 409 && !queuedReel.data.ok) throw new Error(`Instagram queue refused (${queuedReel.status}): ${queuedReel.data.error || '?'}`);
    return;
  }
  const kind = IG_KINDS[draft.meta.format];
  if (!kind) throw new Error(`Instagram format not supported yet: ${draft.meta.format}`);
  const images = draft.meta.images || [];
  if (kind === 'image' && images.length !== 1) throw new Error('an image post needs exactly 1 picture');
  if (kind === 'carousel' && (images.length < 2 || images.length > 10)) throw new Error('a carousel needs 2-10 pictures');
  const urls = [];
  for (const path of images) {
    if (isUrl(path)) { urls.push(path); continue; }
    if (!/\.jpe?g$/i.test(path)) throw new Error(`Instagram needs JPEG pictures: ${path}`);
    const upload = await siteCall('/api/x/media', {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg', 'X-Name': path.split('/').pop() },
      body: readFileSync(localPath(path)),
    });
    if (!upload.data.ok) throw new Error(`picture upload failed (${upload.status}): ${upload.data.error || '?'}`);
    urls.push(upload.data.url);
  }
  const ref = `${date}-${draft.meta.agent_id}-r${draft.meta.rev || 1}`;
  const queued = await siteCall('/api/x/ig', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref, kind, caption: plainCaption(draft.meta.caption), images: urls }),
  });
  if (queued.status === 409) return;
  if (!queued.data.ok) throw new Error(`Instagram queue refused (${queued.status}): ${queued.data.error || '?'}`);
}

/**
 * Agent drafts for `date` whose time has come (Tashkent minutes since midnight):
 * Telegram ones and stories always, Instagram posts only when this bot can publish them.
 */
export function dueAgentKeys(state, date, nowMinutes) {
  return Object.entries(state.drafts)
    .filter(([key, d]) => key.startsWith(`${date} `) && isAgentDraft(d)
      && (CHANNELS[d.meta.channel]?.chat || isStoryDraft(d) || (isInstagramDraft(d) && instagramReady())))
    .filter(([, d]) => {
      const [h, m] = d.slot.split(' ')[0].split(':').map(Number);
      return h * 60 + m <= nowMinutes;
    })
    .map(([key]) => key);
}
