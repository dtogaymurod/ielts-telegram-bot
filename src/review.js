/**
 * Review before publishing — the admin approves every post in a private chat.
 *
 * Flow (all times Tashkent, each step started by the external timer):
 *   21:00  `node src/review.js preview` — prepares tomorrow's 12:00 and 19:30
 *          posts, sends them to the admin exactly as they will look, with
 *          ✅ / ❌ buttons under each.
 *   09:00  `node src/review.js remind`  — reminds about posts still waiting.
 *   12:00 / 19:30  the posting scripts publish only an approved draft.
 *
 * No server is needed: button taps wait on Telegram's side (kept 24 hours)
 * and every run reads them with getUpdates, saving the decision in
 * content/review.json. A post nobody approved is not published and stays
 * first in its queue.
 *
 * Turned on by the TELEGRAM_ADMIN_ID secret (the admin's numeric user id).
 * Without it the bot posts straight to the channel as before.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { callApi, setTargetChat, validateConfig } from './telegram.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REVIEW_FILE = join(__dirname, '..', 'content', 'review.json');
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const KEEP_DAYS = 14;
const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

export const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;

export function reviewEnabled() {
  return Boolean(ADMIN_ID);
}

/** Tashkent date (YYYY-MM-DD), `offsetDays` from today. */
export function tashkentDate(offsetDays = 0) {
  return new Date(Date.now() + 5 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** A Date whose UTC fields read as Tashkent time on that date at noon (for weekday maths). */
export function dateAt(date) {
  return new Date(`${date}T12:00:00Z`);
}

function draftKey(date, slot) {
  return `${date} ${slot}`;
}

function load() {
  if (!existsSync(REVIEW_FILE)) return { last_update_id: 0, drafts: {} };
  return JSON.parse(readFileSync(REVIEW_FILE, 'utf-8'));
}

function save(state) {
  const oldest = tashkentDate(-KEEP_DAYS);
  for (const key of Object.keys(state.drafts)) {
    if (key < oldest) delete state.drafts[key];
  }
  writeFileSync(REVIEW_FILE, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

function sendAdmin(text, extra = {}) {
  return callApi('sendMessage', { chat_id: ADMIN_ID, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });
}

function buttons(key) {
  return {
    inline_keyboard: [[
      { text: '✅ Chiqsin', callback_data: `r:ok:${key}` },
      { text: '❌ Chiqmasin', callback_data: `r:no:${key}` },
    ]],
  };
}

const STATUS_TEXT = {
  pending: '⏳ Javobingiz kutilmoqda',
  approved: '✅ Tasdiqlandi, vaqtida kanalga chiqadi',
  rejected: '❌ Bekor qilindi, kanalga chiqmaydi',
  published: '📢 Kanalga chiqdi',
  skipped: '⏭ Tasdiqlanmagani uchun chiqmadi',
};

function buttonsText(draft) {
  return `<b>${draft.label}</b>\nShu post kanalga chiqsinmi?\n\n${STATUS_TEXT[draft.status]}`;
}

/** Rewrite the buttons message so it shows the current status (buttons stay until the post is done). */
async function refreshButtons(key, draft) {
  if (!draft.buttons_message_id) return;
  const done = draft.status === 'published' || draft.status === 'skipped';
  try {
    await callApi('editMessageText', {
      chat_id: ADMIN_ID,
      message_id: draft.buttons_message_id,
      text: buttonsText(draft),
      parse_mode: 'HTML',
      ...(done ? {} : { reply_markup: buttons(key) }),
    });
  } catch (error) {
    // "message is not modified" and similar are harmless
    if (!/not modified/.test(error.message)) console.log(`⚠️ Could not update buttons for ${key}: ${error.message}`);
  }
}

/**
 * Read button taps from Telegram, save them, and confirm them so they are
 * not read twice. The admin can change their mind until the post goes out.
 */
async function syncDecisions(state) {
  const updates = await callApi('getUpdates', { offset: state.last_update_id + 1, timeout: 0, allowed_updates: ['callback_query', 'message'] });
  const changed = new Set();
  for (const update of updates) {
    state.last_update_id = Math.max(state.last_update_id, update.update_id);
    const query = update.callback_query;
    if (!query || String(query.from.id) !== String(ADMIN_ID)) continue;
    const match = /^r:(ok|no):(.+)$/.exec(query.data || '');
    const draft = match && state.drafts[match[2]];
    if (!draft || !['pending', 'approved', 'rejected'].includes(draft.status)) continue;
    draft.status = match[1] === 'ok' ? 'approved' : 'rejected';
    draft.decided_at = new Date().toISOString();
    changed.add(match[2]);
  }
  if (updates.length) await callApi('getUpdates', { offset: state.last_update_id + 1, timeout: 0 });
  for (const key of changed) await refreshButtons(key, state.drafts[key]);
  return state;
}

/** Load the review state with the latest button taps applied. */
export async function openReview() {
  const state = await syncDecisions(load());
  save(state);
  return state;
}

/**
 * Send a prepared post to the admin as a preview and store it as a draft.
 * `send` posts the messages through the normal send* helpers.
 */
export async function submitDraft(state, { date, slot, label, meta, send }) {
  const key = draftKey(date, slot);
  const weekday = WEEKDAYS[dateAt(date).getUTCDay()];
  const fullLabel = `${weekday}, ${date.slice(8)}.${date.slice(5, 7)} · ${slot} · ${label}`;
  await sendAdmin(`👀 <b>Ko‘rib chiqish</b>\n${fullLabel}\n\nPost kanalda quyidagicha ko‘rinadi 👇`);
  setTargetChat(ADMIN_ID);
  try {
    await send();
  } finally {
    setTargetChat(CHANNEL_ID);
  }
  const draft = { date, slot, label: fullLabel, meta, status: 'pending', created_at: new Date().toISOString() };
  const message = await sendAdmin(buttonsText(draft), { reply_markup: buttons(key) });
  draft.buttons_message_id = message.message_id;
  state.drafts[key] = draft;
  save(state);
  return draft;
}

/**
 * At post time: returns the approved draft for today's slot, or null after
 * marking it skipped and telling the admin. `publish(draft)` must send it.
 */
export async function approvedDraft(state, slot) {
  const key = draftKey(tashkentDate(), slot);
  const draft = state.drafts[key];
  if (draft?.status === 'approved') return draft;

  if (!draft) {
    await sendAdmin(`⏭ Bugungi ${slot} posti chiqmadi: kecha ko‘rib chiqish uchun yuborilmagan edi.`);
  } else {
    if (draft.status === 'pending') draft.status = 'skipped';
    save(state);
    await refreshButtons(key, draft);
    if (draft.status === 'skipped') await sendAdmin(`⏭ Bugungi ${slot} posti tasdiqlanmagani uchun chiqmadi. U navbatda birinchi bo‘lib qoladi.`);
  }
  console.log(`ℹ️ Review: ${key} is ${draft ? draft.status : 'missing'}. Not publishing.`);
  return null;
}

export async function markPublished(state, slot) {
  const key = draftKey(tashkentDate(), slot);
  const draft = state.drafts[key];
  if (!draft) return;
  draft.status = 'published';
  draft.published_at = new Date().toISOString();
  save(state);
  await refreshButtons(key, draft);
}

/** 09:00: remind about today's posts that still wait for an answer. */
async function remind(state) {
  const today = tashkentDate();
  const waiting = Object.entries(state.drafts).filter(([key, d]) => key.startsWith(today) && d.status === 'pending');
  for (const [key, draft] of waiting) {
    await sendAdmin(`⏰ <b>Eslatma:</b> bugungi ${draft.slot} posti hali tasdiqlanmagan.\nTasdiqlamasangiz, kanalga chiqmaydi.`, {
      reply_to_message_id: draft.buttons_message_id,
      reply_markup: buttons(key),
    });
  }
  console.log(`⏰ ${waiting.length} post(s) waiting for approval today.`);
}

async function preview(state) {
  const date = tashkentDate(1);
  const sources = [['./genz-post.js', 'prepareGenzDraft'], ['./index.js', 'prepareDailyDraft']];
  for (const [file, name] of sources) {
    try {
      const prepare = (await import(file))[name];
      const draft = await prepare(date);
      if (draft) await submitDraft(state, { date, ...draft });
    } catch (error) {
      console.error(`⚠️ Preview failed (${name}): ${error.message}`);
      await sendAdmin(`⚠️ Ertangi postlardan birini tayyorlab bo‘lmadi: ${error.message}`);
    }
  }
}

async function main() {
  const mode = process.argv[2];
  if (!reviewEnabled()) {
    console.log('ℹ️ TELEGRAM_ADMIN_ID is not set: review is off, nothing to do.');
    return;
  }
  validateConfig();
  const state = await openReview();
  if (mode === 'preview') await preview(state);
  else if (mode === 'remind') await remind(state);
  else if (mode !== 'sync') throw new Error('Usage: node src/review.js preview|remind|sync');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}
