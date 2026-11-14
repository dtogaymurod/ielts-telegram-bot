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
 * Round videos: the admin sends the bot videos at any time; they wait in a
 * queue and go out on Mondays and Thursdays at 17:00 after the same 21:00 review (see
 * "Round videos" below and src/video-note.js).
 *
 * Multilevel channel: one post a day at 18:00 to @dilshod_multilevel, previewed
 * at 21:00 with the others and posted by the listener (src/multilevel.js).
 *
 * Agent posts: posts written by the SMM agents (content/agent-queue.json) are
 * previewed at 21:00 too, with a third ✏️ button that asks what to change
 * (src/agent-posts.js).
 *
 * Turned on by the TELEGRAM_ADMIN_ID secret (the admin's numeric user id).
 * Without it the bot posts straight to the channel as before.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { callApi, setTargetChat, validateConfig } from './telegram.js';
import { MULTILEVEL_TIME, MULTILEVEL_MINUTES, prepareMultilevelDraft, publishMultilevel } from './multilevel.js';
import { HELP_TEXT, videoInMessage, prepareVideoNote, prepareDriveVideo, publishVideoNote, hasFfmpeg } from './video-note.js';
import { prepareAgentDrafts, publishAgentDraft, publishInstagramDraft, isInstagramDraft, deliverStoryDraft, isStoryDraft, dueAgentKeys, isAgentDraft, loadQueue, validPost, agentSlot } from './agent-posts.js';

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

/**
 * The two buttons; the chosen one is marked so the choice is visible on the
 * buttons themselves. Agent posts get a third one, ✏️, to ask for changes.
 */
function buttons(key, status = 'pending', editable = false) {
  const ok = status === 'approved' ? '✅ Chiqadi ✔️' : '✅ Chiqsin';
  const no = status === 'rejected' ? '❌ Chiqmaydi ✔️' : '❌ Chiqmasin';
  const rows = [[
    { text: ok, callback_data: `r:ok:${key}` },
    { text: no, callback_data: `r:no:${key}` },
  ]];
  if (editable) rows.push([{ text: status === 'edit_requested' ? '✏️ Tahrir so‘raldi ✔️' : '✏️ Tahrirlash', callback_data: `r:ed:${key}` }]);
  return { inline_keyboard: rows };
}

/** Draft states in which the admin can still decide. */
const OPEN = ['pending', 'approved', 'rejected', 'edit_requested'];

const STATUS_TEXT = {
  pending: '⏳ Javobingiz kutilmoqda',
  approved: '✅ Tasdiqlandi, vaqtida kanalga chiqadi',
  rejected: '❌ Bekor qilindi, kanalga chiqmaydi',
  published: '📢 Kanalga chiqdi',
  skipped: '⏭ Tasdiqlanmagani uchun chiqmadi',
  failed: '⚠️ Chiqmadi (xato)',
  edit_requested: '✏️ Tahrir so‘raldi: agentlar tuzatib, yangi variantni yuboradi',
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
  const done = ['published', 'skipped', 'failed'].includes(draft.status);
  const markup = done ? { inline_keyboard: [] } : buttons(key, draft.status, isAgentDraft(draft));
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
  if (update.message) return handleMessage(state, update.message);
  const query = update.callback_query;
  if (!query) return null;
  if (/^v:/.test(query.data || '')) return handleQueueButton(state, query);
  const match = /^r:(ok|no|ed):(.+)$/.exec(query.data || '');
  const draft = match && state.drafts[match[2]];
  let answer = '⚠️ Bu post endi o‘zgartirib bo‘lmaydi';
  let key = null;
  if (String(query.from.id) !== String(ADMIN_ID)) {
    answer = '⛔ Faqat admin tasdiqlay oladi';
  } else if (match?.[1] === 'ed' && draft && isAgentDraft(draft) && OPEN.includes(draft.status)) {
    // The next text the admin sends is the change request (see handleMessage)
    state.edit_wait = match[2];
    await sendAdmin(`✏️ <b>${draft.label}</b>\nNima o‘zgarsin? Bitta xabarda yozing, agentlar tuzatib, yangi variantni yuboradi.\n/bekor — tahrirni bekor qilish`, {
      reply_markup: { force_reply: true, input_field_placeholder: 'Nima o‘zgarsin?' },
    });
    answer = '✏️ Nima o‘zgarishini yozing';
  } else if (match && match[1] !== 'ed' && draft && OPEN.includes(draft.status)) {
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

/*
 * Round videos. The admin sends the bot videos in the private chat (one or
 * many at once); each becomes a round video and joins a queue in
 * content/review.json. At 21:00 the first one in the queue is previewed for
 * tomorrow with the usual ✅ / ❌ buttons, and the listener posts it to the
 * channel at VIDEO_TIME if it was approved. Under each queued video there are
 * buttons to post it now or take it out of the queue.
 */
export const VIDEO_TIME = '17:00';
const VIDEO_MINUTES = 17 * 60;

function queueButtons(id) {
  return {
    inline_keyboard: [[
      { text: '📢 Hozir chiqarish', callback_data: `v:now:${id}` },
      { text: '🗑 Navbatdan olish', callback_data: `v:del:${id}` },
    ]],
  };
}

function shortDate(date) {
  return `${date.slice(8)}.${date.slice(5, 7)}`;
}

/** Weekdays (0 = Sunday) a round video goes out on: Monday and Thursday (Dilshod's choice). */
const VIDEO_WEEKDAYS = [1, 4];
const WEEKDAY_NAMES = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const SCHEDULE_TEXT = `har ${VIDEO_WEEKDAYS.map((d) => WEEKDAY_NAMES[d]).join(' va ')} ${VIDEO_TIME} da`;

function isVideoDay(offset) {
  return VIDEO_WEEKDAYS.includes(dateAt(tashkentDate(offset)).getUTCDay());
}

/** The Tashkent date the video at `position` (0 = first) is expected to go out. */
function expectedDate(state, position) {
  const d = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const now = d.getUTCHours() * 60 + d.getUTCMinutes();
  const live = (offset) => ['pending', 'approved'].includes(state.drafts[`${tashkentDate(offset)} ${VIDEO_TIME}`]?.status);
  let offset;
  if (live(0) && now < VIDEO_MINUTES) offset = 0;
  else if (live(1)) offset = 1;
  else offset = now >= 21 * 60 ? 2 : 1; // tomorrow's review runs at 21:00
  while (!isVideoDay(offset) && !(offset <= 1 && live(offset))) offset += 1;
  for (let left = position; left > 0; left -= 1) {
    offset += 1;
    while (!isVideoDay(offset)) offset += 1;
  }
  return tashkentDate(offset);
}

/** A message from the admin in the private chat. Other people's messages are ignored. */
async function handleMessage(state, message) {
  if (String(message.from?.id) !== String(ADMIN_ID) || message.chat?.type !== 'private') return null;
  if (state.edit_wait && message.text) return handleEditRequest(state, message.text);
  const video = videoInMessage(message);
  if (!video) {
    if (/^\/(video|start|help)\b/.test(message.text || '')) await sendAdmin(HELP_TEXT);
    if (/^\/navbat\b/.test(message.text || '')) await showQueue(state);
    return null;
  }
  state.videos = state.videos || [];
  const id = String(message.message_id);
  if (state.videos.some((v) => v.id === id)) return null;
  console.log(`🎥 Admin sent a ${video.kind}, preparing round video`);
  try {
    const ready = await prepareVideoNote(callApi, ADMIN_ID, video, message.message_id);
    state.videos.push({ id, file_id: ready.fileId, duration: Math.round(ready.duration), added_at: new Date().toISOString() });
    const position = state.videos.length;
    const lines = [
      `📥 <b>Navbatga qo‘shildi: ${position}-o‘rin</b>`,
      `Taxminan ${shortDate(expectedDate(state, position - 1))} kuni soat ${VIDEO_TIME} da chiqadi (oldingi kuni 21:00 da sizga ✅/❌ bilan ko‘rsataman).`,
      ...ready.notes,
    ];
    await sendAdmin(lines.join('\n'), { reply_to_message_id: message.message_id, reply_markup: queueButtons(id) });
    return '#videos';
  } catch (error) {
    console.log(`⚠️ Round video failed: ${error.message}`);
    try { await sendAdmin(`⚠️ Videoni dumaloq qilib bo‘lmadi.\n${error.message}\n\n${HELP_TEXT}`); } catch {}
    return null;
  }
}

/** The admin's answer after ✏️: saved on the draft for the agents to pick up. */
async function handleEditRequest(state, text) {
  const key = state.edit_wait;
  delete state.edit_wait;
  const draft = state.drafts[key];
  if (/^\/bekor\b/.test(text)) {
    await sendAdmin('↩️ Tahrir bekor qilindi, post avvalgi holatida qoldi.');
    return '#edit';
  }
  if (!draft || !OPEN.includes(draft.status)) {
    await sendAdmin('⚠️ Bu postni endi o‘zgartirib bo‘lmaydi.');
    return '#edit';
  }
  draft.status = 'edit_requested';
  draft.edit_request = text;
  draft.decided_at = new Date().toISOString();
  await sendAdmin('📝 Qabul qilindi. Agentlar tuzatib, yangi variantni shu yerga ✅ / ❌ bilan yuboradi.');
  return key;
}

async function showQueue(state) {
  const videos = state.videos || [];
  if (!videos.length) return sendAdmin('📭 Navbatda video yo‘q. Videoni shu chatga yuboring.');
  const list = videos.map((v, i) => `${i + 1}. ${shortDate(expectedDate(state, i))} · ${v.name ? `${v.name} · ` : ''}${v.duration} soniya`).join('\n');
  return sendAdmin(`🎥 <b>Navbatda ${videos.length} ta video</b> (${SCHEDULE_TEXT} bittadan):\n${list}`);
}

async function postVideo(state, video) {
  await publishVideoNote(callApi, CHANNEL_ID, video.file_id);
  state.videos = (state.videos || []).filter((v) => v.id !== video.id);
  console.log(`📢 Round video ${video.id} posted`);
}

/** "Post now" / "Remove" under a queued video. */
async function handleQueueButton(state, query) {
  const [, action, id] = query.data.split(':');
  const video = (state.videos || []).find((v) => v.id === id);
  let answer = '⚠️ Bu video navbatda endi yo‘q';
  let changed = null;
  if (String(query.from.id) !== String(ADMIN_ID)) {
    answer = '⛔ Faqat admin boshqara oladi';
  } else if (video) {
    try {
      if (action === 'now') {
        await postVideo(state, video);
        answer = '📢 Dumaloq video kanalga chiqdi';
      } else {
        state.videos = state.videos.filter((v) => v.id !== id);
        answer = '🗑 Navbatdan olib tashlandi';
      }
      changed = '#videos';
      // A preview already made for this video is no longer valid
      for (const [key, draft] of Object.entries(state.drafts)) {
        if (draft.meta?.video_id === id && ['pending', 'approved', 'rejected'].includes(draft.status)) {
          draft.status = action === 'now' ? 'published' : 'rejected';
          await refreshButtons(key, draft);
        }
      }
      try { await callApi('editMessageReplyMarkup', { chat_id: ADMIN_ID, message_id: query.message.message_id, reply_markup: { inline_keyboard: [] } }); } catch {}
    } catch (error) {
      answer = '⚠️ Kanalga chiqmadi, yana bir bor bosib ko‘ring';
      console.log(`⚠️ Round video not posted: ${error.message}`);
    }
  }
  try { await callApi('answerCallbackQuery', { callback_query_id: query.id, text: answer }); } catch {}
  return changed;
}

/**
 * Videos listed in content/video-import.json ({ "files": [{ "id", "name" }] },
 * Google Drive files shared with anyone who has the link) join the end of
 * the queue in the listed order, once each. Runs when a listener starts.
 */
const IMPORT_FILE = join(__dirname, '..', 'content', 'video-import.json');

async function importVideos(state, persist) {
  if (!existsSync(IMPORT_FILE) || !hasFfmpeg()) return;
  const files = JSON.parse(readFileSync(IMPORT_FILE, 'utf-8')).files || [];
  state.imported = state.imported || [];
  const todo = files.filter((f) => !state.imported.includes(f.id));
  // Imported videos follow the order of the list (it can be reordered later)
  const rank = new Map(files.map((f, i) => [`d-${f.id}`, i]));
  const reorder = () => {
    // A Drive video taken out of the list leaves the queue too
    state.videos = (state.videos || []).filter((v) => !v.id.startsWith('d-') || rank.has(v.id));
    const listed = (state.videos || []).filter((v) => rank.has(v.id)).sort((a, b) => rank.get(a.id) - rank.get(b.id));
    let next = 0;
    state.videos = (state.videos || []).map((v) => (rank.has(v.id) ? listed[next++] : v));
  };
  reorder();
  if (!todo.length) { persist(); return; }
  console.log(`📥 Importing ${todo.length} video(s) from Google Drive`);
  state.videos = state.videos || [];
  let added = 0;
  const failed = [];
  for (const file of todo) {
    try {
      const ready = await prepareDriveVideo(ADMIN_ID, file.id);
      state.videos.push({ id: `d-${file.id}`, name: file.name, file_id: ready.fileId, duration: Math.round(ready.duration), added_at: new Date().toISOString() });
      state.imported.push(file.id);
      added += 1;
      reorder();
      if (ready.notes.length) console.log(`   ${file.name}: ${ready.notes.join(' ')}`);
      persist();
    } catch (error) {
      console.log(`⚠️ ${file.name}: ${error.message}`);
      failed.push(`• ${file.name}: ${error.message}`);
    }
  }
  const last = state.videos.length ? shortDate(expectedDate(state, state.videos.length - 1)) : '';
  const lines = [`📥 <b>Google Drive'dan ${added} ta video navbatga qo‘shildi</b>`, `Navbatda jami ${state.videos.length} ta, ${SCHEDULE_TEXT} bittadan, oxirgisi taxminan ${last}.`, '/navbat — ro‘yxatni ko‘rish'];
  if (failed.length) lines.push('', `⚠️ ${failed.length} tasini ololmadim:`, ...failed.slice(0, 15));
  await sendAdmin(lines.join('\n'));
  persist();
}

/** 21:00: the first video in the queue goes into tomorrow's review. */
export function prepareVideoDraft(state, date = tashkentDate(1)) {
  const video = (state.videos || [])[0];
  if (!video) return null;
  if (!VIDEO_WEEKDAYS.includes(dateAt(date).getUTCDay())) return null; // only on video weekdays
  return {
    slot: VIDEO_TIME,
    label: `🎥 Dumaloq video (navbatda ${state.videos.length} ta)`,
    meta: { video_id: video.id },
    send: () => callApi('sendVideoNote', { chat_id: ADMIN_ID, video_note: video.file_id }),
  };
}

/** From VIDEO_TIME on: post today's approved video once. Returns true if the state changed. */
async function publishDueVideo(state) {
  const d = new Date(Date.now() + 5 * 60 * 60 * 1000);
  if (d.getUTCHours() * 60 + d.getUTCMinutes() < VIDEO_MINUTES) return false;
  const key = `${tashkentDate()} ${VIDEO_TIME}`;
  const draft = state.drafts[key];
  if (!draft || !['pending', 'approved'].includes(draft.status)) return false;
  const video = (state.videos || []).find((v) => v.id === draft.meta?.video_id);
  if (draft.status === 'pending' || !video) {
    draft.status = 'skipped';
    await refreshButtons(key, draft);
    if (video) await sendAdmin(`⏭ Bugungi ${VIDEO_TIME} dumaloq videosi tasdiqlanmagani uchun chiqmadi. U navbatda birinchi bo‘lib qoladi.`);
    return true;
  }
  try {
    await postVideo(state, video);
  } catch (error) {
    console.log(`⚠️ Round video not posted: ${error.message}`);
    return false; // tried again on the next loop
  }
  draft.status = 'published';
  draft.published_at = new Date().toISOString();
  await refreshButtons(key, draft);
  return true;
}

/** From MULTILEVEL_TIME on: post today's approved Multilevel post once. Returns true if the state changed. */
async function publishDueMultilevel(state) {
  const d = new Date(Date.now() + 5 * 60 * 60 * 1000);
  if (d.getUTCHours() * 60 + d.getUTCMinutes() < MULTILEVEL_MINUTES) return false;
  const key = `${tashkentDate()} ${MULTILEVEL_TIME}`;
  const draft = state.drafts[key];
  if (!draft || !['pending', 'approved'].includes(draft.status)) return false;
  if (draft.status === 'pending') {
    draft.status = 'skipped';
    await refreshButtons(key, draft);
    await sendAdmin(`⏭ Bugungi ${MULTILEVEL_TIME} Multilevel posti tasdiqlanmagani uchun chiqmadi. U navbatda birinchi bo‘lib qoladi.`);
    return true;
  }
  try {
    await publishMultilevel(state, draft);
  } catch (error) {
    console.log(`⚠️ Multilevel post not published: ${error.message}`);
    // Tried again on the next loop; the admin hears about it once
    if (!draft.error_sent) {
      draft.error_sent = true;
      try { await sendAdmin(`⚠️ Multilevel kanalga post chiqmadi: ${error.message}\nBot @dilshod_multilevel kanalida admin ekanini tekshiring. Qayta urinib ko‘raman.`); } catch {}
      return true;
    }
    return false;
  }
  draft.status = 'published';
  draft.published_at = new Date().toISOString();
  await refreshButtons(key, draft);
  return true;
}

/**
 * Agent posts whose time has come: approved ones go to their channel (Instagram
 * ones to the mock site's Instagram queue), the rest are marked skipped. Returns true if the state changed.
 */
async function publishDueAgentPosts(state) {
  const d = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const now = d.getUTCHours() * 60 + d.getUTCMinutes();
  let changed = false;
  for (const key of dueAgentKeys(state, tashkentDate(), now)) {
    const draft = state.drafts[key];
    if (!['pending', 'approved', 'edit_requested'].includes(draft.status)) continue;
    if (draft.status !== 'approved') {
      draft.status = 'skipped';
      await refreshButtons(key, draft);
      changed = true;
      continue;
    }
    try {
      if (isInstagramDraft(draft)) await publishInstagramDraft(draft, tashkentDate());
      else if (isStoryDraft(draft)) await deliverStoryDraft(draft, ADMIN_ID);
      else await publishAgentDraft(draft);
    } catch (error) {
      console.log(`⚠️ Agent post ${key} not published: ${error.message}`);
      if (isInstagramDraft(draft)) {
        // Instagram: three tries, then give up (no endless uploads)
        draft.tries = (draft.tries || 0) + 1;
        changed = true;
        if (draft.tries >= 3) {
          draft.status = 'failed';
          await refreshButtons(key, draft);
          try { await sendAdmin(`⚠️ Instagram posti chiqmadi (${draft.label}): ${error.message}`); } catch {}
        }
        continue;
      }
      if (!draft.error_sent) {
        draft.error_sent = true;
        try { await sendAdmin(`⚠️ Agent posti chiqmadi (${draft.label}): ${error.message}\nQayta urinib ko‘raman.`); } catch {}
        changed = true;
      }
      continue;
    }
    draft.status = 'published';
    draft.published_at = new Date().toISOString();
    await refreshButtons(key, draft);
    changed = true;
  }
  return changed;
}

/**
 * Read button taps from Telegram, save them, and confirm them so they are
 * not read twice. The admin can change their mind until the post goes out.
 * `timeout` > 0 waits (long polling) for a tap to arrive.
 */
async function syncDecisions(state, timeout = 0) {
  const updates = await callApi('getUpdates', { offset: state.last_update_id + 1, timeout, allowed_updates: ['callback_query', 'message'] });
  const changed = new Set();
  for (const update of updates) {
    const key = await applyUpdate(state, update);
    if (key) changed.add(key);
  }
  if (updates.length) await callApi('getUpdates', { offset: state.last_update_id + 1, timeout: 0 });
  for (const key of changed) if (state.drafts[key]) await refreshButtons(key, state.drafts[key]);
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
  const persist = () => {
    save(state);
    if (!process.env.REVIEW_SAVE_CMD) return;
    try { execSync(process.env.REVIEW_SAVE_CMD, { stdio: 'inherit' }); } catch (error) { console.log(`⚠️ Save failed: ${error.message}`); }
  };
  try { await importVideos(state, persist); } catch (error) { console.log(`⚠️ Import failed: ${error.message}`); }
  console.log(`👂 Listening for button taps for ${Math.round((end - Date.now()) / 60000)} min`);
  while (Date.now() < end - 5000) {
    const wait = Math.max(1, Math.min(50, Math.floor((end - Date.now()) / 1000) - 5));
    try {
      const videoChanged = await publishDueVideo(state);
      const multilevelChanged = await publishDueMultilevel(state);
      const agentChanged = await publishDueAgentPosts(state);
      if ((await syncDecisions(state, wait)) || videoChanged || multilevelChanged || agentChanged) {
        persist();
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
  // A resent preview keeps the old buttons working and updated
  const previous = state.drafts[key];
  if (previous?.buttons_message_id) draft.extra_button_ids = [...(previous.extra_button_ids || []), previous.buttons_message_id];
  const message = await sendAdmin(buttonsText(draft), { reply_markup: buttons(key, 'pending', isAgentDraft(draft)) });
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
      reply_markup: buttons(key, 'pending', isAgentDraft(draft)),
    });
    draft.extra_button_ids = [...(draft.extra_button_ids || []), message.message_id];
  }
  console.log(`⏰ ${waiting.length} post(s) waiting for approval today.`);
  save(state);
}

/** Tomorrow's posts to the admin. `only` (e.g. "19:30") resends just that slot. */
async function preview(state, only) {
  // REVIEW_DATE (YYYY-MM-DD) catches up a missed evening preview, e.g. today's posts after midnight
  const date = /^\d{4}-\d{2}-\d{2}$/.test(process.env.REVIEW_DATE || '') ? process.env.REVIEW_DATE : tashkentDate(1);
  const sources = [['./genz-post.js', 'prepareGenzDraft', '12:00'], ['./index.js', 'prepareDailyDraft', '19:30']];
  for (const [file, name, slot] of sources) {
    if (only && only !== slot) continue;
    try {
      const prepare = (await import(file))[name];
      const draft = await prepare(date);
      if (draft) await submitDraft(state, { date, ...draft });
    } catch (error) {
      console.error(`⚠️ Preview failed (${name}): ${error.message}`);
      await sendAdmin(`⚠️ Ertangi postlardan birini tayyorlab bo‘lmadi: ${error.message}`);
    }
  }
  if (!only || only === VIDEO_TIME) {
    try {
      const draft = prepareVideoDraft(state, date);
      if (draft) await submitDraft(state, { date, ...draft });
    } catch (error) {
      console.error(`⚠️ Video preview failed: ${error.message}`);
      await sendAdmin(`⚠️ Ertangi dumaloq videoni ko‘rsatib bo‘lmadi: ${error.message}`);
    }
  }
  if (!only || only === MULTILEVEL_TIME) await previewMultilevel(state, date);
  await previewAgentPosts(state, date, only);
}

/** Agent posts for `date`. `only` = "agent" for all of them, or one agent slot ("18:00 ig1"). */
async function previewAgentPosts(state, date, only) {
  const known = ['12:00', '19:30', VIDEO_TIME, MULTILEVEL_TIME];
  if (known.includes(only)) return;
  const pick = only === 'agent' ? '' : only;
  let drafts = [];
  try {
    drafts = prepareAgentDrafts(date, ADMIN_ID, pick);
  } catch (error) {
    console.error(`⚠️ Agent queue unreadable: ${error.message}`);
    await sendAdmin(`⚠️ Agentlar navbatini o‘qib bo‘lmadi: ${error.message}`);
    return;
  }
  const bad = loadQueue().filter((p) => p.date === date && !validPost(p));
  if (bad.length) await sendAdmin(`⚠️ Agentlarning ${bad.length} ta posti noto‘g‘ri yozilgan, ko‘rsatilmadi: ${bad.map((p) => p.id || '?').join(', ')}`);
  for (const draft of drafts) {
    try {
      await submitDraft(state, { date, ...draft });
    } catch (error) {
      console.error(`⚠️ Agent preview failed (${draft.slot}): ${error.message}`);
      await sendAdmin(`⚠️ Agent postini ko‘rsatib bo‘lmadi (${draft.slot}): ${error.message}`);
    }
  }
}

async function previewMultilevel(state, date) {
  try {
    const draft = prepareMultilevelDraft(state);
    if (draft) await submitDraft(state, { date, ...draft });
    else await sendAdmin('📭 Multilevel kanal uchun postlar bazasi tugadi. Yangi postlar kerak.');
  } catch (error) {
    console.error(`⚠️ Multilevel preview failed: ${error.message}`);
    await sendAdmin(`⚠️ Ertangi Multilevel postini tayyorlab bo‘lmadi: ${error.message}`);
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
  if (mode === 'preview') await preview(state, process.argv[3] || process.env.REVIEW_SLOT || '');
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
