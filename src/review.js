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

/** The two buttons; the chosen one is marked so the choice is visible on the buttons themselves. */
function buttons(key, status = 'pending') {
  const ok = status === 'approved' ? '✅ Chiqadi ✔️' : '✅ Chiqsin';
  const no = status === 'rejected' ? '❌ Chiqmaydi ✔️' : '❌ Chiqmasin';
  return {
    inline_keyboard: [[
      { text: ok, callback_data: `r:ok:${key}` },
      { text: no, callback_data: `r:no:${key}` },
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

/**
 * Rewrite the buttons message so it shows the current status (buttons stay,
 * with the choice marked, until the post is done). Buttons repeated under a
 * reminder are updated too.
 */
async function refreshButtons(key, draft) {
  const done = draft.status === 'published' || draft.status === 'skipped';
  const markup = done ? { inline_keyboard: [] } : buttons(key, draft.status);
  const harmless = (error) => {
    if (!/not modified|not found|can't be edited/.test(error.message)) console.log(`⚠️ Could not update buttons for ${key}: ${error.message}`);
  };
  if (draft.buttons_message_id) {
    try {
      await callApi('editMessageText', {
        chat_id: ADMIN_ID,
        message_id: draft.buttons_message_id,
        text: buttonsText(draft),
        parse_mode: 'HTML',
        reply_markup: markup,
      });
    } catch (error) { harmless(error); }
  }
  for (const id of draft.extra_button_ids || []) {
    try {
      await callApi('editMessageReplyMarkup', { chat_id: ADMIN_ID, message_id: id, reply_markup: markup });
    } catch (error) { harmless(error); }
  }
}

/** Apply one update (a button tap) to the state. Returns the draft key it changed, or null. */
async function applyUpdate(state, update) {
  state.last_update_id = Math.max(state.last_update_id, update.update_id);
  const query = update.callback_query;
  if (!query) return null;
  const match = /^r:(ok|no):(.+)$/.exec(query.data || '');
  const draft = match && state.drafts[match[2]];
  let answer = '⚠️ Bu post endi o‘zgartirib bo‘lmaydi';
  let key = null;
  if (String(query.from.id) !== String(ADMIN_ID)) {
    answer = '⛔ Faqat admin tasdiqlay oladi';
  } else if (draft && ['pending', 'approved', 'rejected'].includes(draft.status)) {
    draft.status = match[1] === 'ok' ? 'approved' : 'rejected';
    draft.decided_at = new Date().toISOString();
    const tapped = query.message?.message_id;
    if (tapped && tapped !== draft.buttons_message_id && !(draft.extra_button_ids || []).includes(tapped)) {
      draft.extra_button_ids = [...(draft.extra_button_ids || []), tapped];
    }
    answer = draft.status === 'approved' ? '✅ Qabul qilindi: post vaqtida chiqadi' : '❌ Qabul qilindi: post chiqmaydi';
    key = match[2];
  }
  // Stops the spinner on the button. Fails harmlessly for taps older than a few minutes.
  try {
    await callApi('answerCallbackQuery', { callback_query_id: query.id, text: answer });
  } catch {}
  return key;
}

/**
 * Read button taps from Telegram, save them, and confirm them so they are
 * not read twice. The admin can change their mind until the post goes out.
 * `timeout` > 0 waits (long polling) for a tap to arrive.
 */
async function syncDecisions(state, timeout = 0) {
  const updates = await callApi('getUpdates', { offset: state.last_update_id + 1, timeout, allowed_updates: ['callback_query'] });
  const changed = new Set();
  for (const update of updates) {
    const key = await applyUpdate(state, update);
    if (key) changed.add(key);
  }
  if (updates.length) await callApi('getUpdates', { offset: state.last_update_id + 1, timeout: 0 });
  for (const key of changed) await refreshButtons(key, state.drafts[key]);
  return changed.size;
}

/**
 * Stay online and answer button taps right away. A run stops shortly before
 * the next scheduled run (08:55, 11:50, 19:20, 20:55 Tashkent), which starts
 * listening again when it is done. GitHub ends a job after 6 hours, so a
 * longer wait stops at ~5h50m and writes .listen-continue: the workflow then
 * starts the next listening run (see review.yml). Together the bot answers
 * around the clock, apart from the few minutes a post is being sent.
 */
const STOPS = [8 * 60 + 55, 11 * 60 + 50, 19 * 60 + 20, 20 * 60 + 55];
const MAX_MINUTES = 350;

async function listen(state) {
  const d = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const now = d.getUTCHours() * 60 + d.getUTCMinutes();
  const stop = STOPS.find((m) => m > now + 1) ?? STOPS[0] + 24 * 60;
  const capped = stop - now > MAX_MINUTES;
  const end = Date.now() + Math.min(stop - now, MAX_MINUTES) * 60 * 1000 - d.getUTCSeconds() * 1000;
  console.log(`👂 Listening for button taps for ${Math.round((end - Date.now()) / 60000)} min`);
  while (Date.now() < end - 5000) {
    const wait = Math.max(1, Math.min(50, Math.floor((end - Date.now()) / 1000) - 5));
    try {
      if (await syncDecisions(state, wait)) {
        save(state);
        if (process.env.REVIEW_SAVE_CMD) {
          const { execSync } = await import('child_process');
          try { execSync(process.env.REVIEW_SAVE_CMD, { stdio: 'inherit' }); } catch (error) { console.log(`⚠️ Save failed: ${error.message}`); }
        }
      }
    } catch (error) {
      console.log(`⚠️ getUpdates failed: ${error.message}`);
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
  save(state);
  if (capped) writeFileSync(join(__dirname, '..', '.listen-continue'), '');
}

/** Load the review state with the latest button taps applied. */
export async function openReview() {
  const state = load();
  await syncDecisions(state);
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
    const message = await sendAdmin(`⏰ <b>Eslatma:</b> bugungi ${draft.slot} posti hali tasdiqlanmagan.\nTasdiqlamasangiz, kanalga chiqmaydi.`, {
      reply_to_message_id: draft.buttons_message_id,
      reply_markup: buttons(key),
    });
    draft.extra_button_ids = [...(draft.extra_button_ids || []), message.message_id];
  }
  console.log(`⏰ ${waiting.length} post(s) waiting for approval today.`);
  save(state);
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
  else if (mode !== 'sync' && mode !== 'listen') throw new Error('Usage: node src/review.js preview|remind|sync|listen');
  // After sending, stay online so a tap gets an answer right away
  if (mode !== 'sync' && process.env.REVIEW_LISTEN !== '0') await listen(state);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}
