/**
 * Multilevel channel (@dilshod_multilevel) — one post a day at 18:00.
 *
 * Posts are ready-made in content/multilevel-posts.json: a picture-first
 * poster (poster/render_visual.py, the channel's own colour theme) and a
 * caption that carries the explanation (Uzbek, with English examples). They go through the same review as the main channel:
 *   21:00  review.js preview shows tomorrow's post to the admin with ✅ / ❌
 *   18:00  the listener (review.js listen) posts it if it was approved
 * Which post is next is kept in content/review.json (state.multilevel.next),
 * so the bank file itself never changes during a run.
 *
 * The channel is MULTILEVEL_CHANNEL_ID (defaults to @dilshod_multilevel);
 * the bot must be an admin there.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { callApi, sendLocalPhoto, setTargetChat } from './telegram.js';
import { renderVisualPoster } from './poster.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANK_FILE = join(__dirname, '..', 'content', 'multilevel-posts.json');

export const MULTILEVEL_CHANNEL_ID = process.env.MULTILEVEL_CHANNEL_ID || '@dilshod_multilevel';
export const MULTILEVEL_TIME = '18:00';
export const MULTILEVEL_MINUTES = 18 * 60;

function loadBank() {
  if (!existsSync(BANK_FILE)) return null;
  return JSON.parse(readFileSync(BANK_FILE, 'utf-8'));
}

/** The bank post that goes out next, with the poster fields filled in. */
export function nextPost(state) {
  const bank = loadBank();
  if (!bank?.posts?.length) return null;
  const index = state.multilevel?.next ?? 0;
  const post = bank.posts[index];
  if (!post) return null;
  return {
    index,
    left: bank.posts.length - index,
    post: { theme: bank.theme, exam: 'MULTILEVEL', handle: MULTILEVEL_CHANNEL_ID, note: bank.note, ...post },
  };
}

/** 21:00: tomorrow's Multilevel post for the review (every day). */
export function prepareMultilevelDraft(state) {
  const next = nextPost(state);
  if (!next) return null;
  const { index, left, post } = next;
  const meta = { multilevel_index: index, post_id: post.id };
  return {
    slot: MULTILEVEL_TIME,
    label: `🟢 Multilevel kanal · ${post.title} (bazada ${left} ta qoldi)`,
    meta,
    send: async () => {
      const path = renderVisualPoster(post);
      if (!path) throw new Error(`Multilevel poster could not be drawn: ${post.id}`);
      const sent = await sendLocalPhoto(path, post.caption || '');
      // The channel gets exactly the picture that was approved
      meta.photo = sent.photo?.at(-1)?.file_id;
      meta.caption = post.caption || '';
    },
  };
}

/** Post an approved draft to the Multilevel channel and move the bank on. */
export async function publishMultilevel(state, draft) {
  const photo = draft.meta?.photo;
  if (photo) {
    await callApi('sendPhoto', { chat_id: MULTILEVEL_CHANNEL_ID, photo, caption: draft.meta.caption || '', parse_mode: 'HTML' });
  } else {
    // Preview without a saved picture: draw the same post again
    const next = nextPost(state);
    const path = next && renderVisualPoster(next.post);
    if (!path) throw new Error('Multilevel poster could not be drawn');
    setTargetChat(MULTILEVEL_CHANNEL_ID);
    try {
      await sendLocalPhoto(path, next.post.caption || '');
    } finally {
      setTargetChat(process.env.TELEGRAM_CHANNEL_ID);
    }
  }
  const done = draft.meta?.multilevel_index ?? state.multilevel?.next ?? 0;
  state.multilevel = { ...(state.multilevel || {}), next: done + 1 };
  console.log(`📢 Multilevel post ${draft.meta?.post_id || done} published to ${MULTILEVEL_CHANNEL_ID}`);
}
