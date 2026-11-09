/**
 * Round videos (Telegram "video notes") for the channel.
 *
 * The admin sends the bot a video in the private chat. The bot turns it into
 * a round video (square 640×640, at most 60 seconds), sends it back as a
 * preview with ✅ / ❌ buttons, and on ✅ posts it to the channel right away.
 *
 * Accepted: a regular video, a video sent as a file, or a round video.
 * A video that is not square is cropped to its centre, a longer one is cut
 * at 60 seconds; the admin is told when this happens. Telegram lets a bot
 * download files up to 20 MB, so bigger files are refused with a message.
 *
 * Needs ffmpeg (installed in review.yml). Runs inside the review listener
 * (src/review.js), so no extra bot or server is needed.
 */

import { mkdtempSync, rmSync, writeFileSync, readFileSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SIZE = 640;
const MAX_SECONDS = 60;
const MAX_DOWNLOAD = 20 * 1024 * 1024;

export const HELP_TEXT = [
  '🎥 <b>Dumaloq video chiqarish</b>',
  '',
  'Videoni shu chatga oddiy video qilib yuboring (yoki fayl qilib, yoki dumaloq video yozib).',
  'Bot uni dumaloq videoga aylantirib, sizga ko‘rsatadi. ✅ bossangiz, darhol kanalga chiqadi.',
  '',
  '📐 Eng yaxshisi: kvadrat (640×640), 60 soniyagacha, 20 MB dan kichik.',
  '• Kvadrat bo‘lmasa, o‘rtasi kesib olinadi (tepa/past yoki chetlar ko‘rinmay qoladi).',
  '• 60 soniyadan uzun bo‘lsa, 60-soniyada kesiladi.',
  '• Dumaloq ramka kvadratning burchaklarini yopadi, muhim narsani o‘rtaroqda saqlang.',
].join('\n');

/** The video in an admin message, or null. */
export function videoInMessage(message) {
  if (message.video_note) return { kind: 'video_note', ...message.video_note };
  if (message.video) return { kind: 'video', ...message.video };
  if (message.document && /^video\//.test(message.document.mime_type || '')) return { kind: 'document', ...message.document };
  return null;
}

export function hasFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function download(callApi, fileId, dest) {
  const file = await callApi('getFile', { file_id: fileId });
  const response = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`);
  if (!response.ok) throw new Error(`download failed (${response.status})`);
  writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
}

function probe(path) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration',
    '-of', 'json', path,
  ]).toString();
  const data = JSON.parse(out);
  const stream = data.streams?.[0];
  if (!stream) throw new Error('faylda video topilmadi');
  return { width: stream.width, height: stream.height, duration: Number(data.format?.duration) || 0 };
}

function convert(input, output) {
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-i', input, '-t', String(MAX_SECONDS),
    '-vf', `crop='min(iw,ih)':'min(iw,ih)',scale=${SIZE}:${SIZE},setsar=1`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
    '-movflags', '+faststart', output,
  ], { stdio: 'inherit' });
}

async function uploadVideoNote(chatId, path, duration, extra = {}) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('video_note', new Blob([readFileSync(path)], { type: 'video/mp4' }), 'round.mp4');
  form.append('length', String(SIZE));
  form.append('duration', String(Math.round(duration)));
  for (const [k, v] of Object.entries(extra)) if (v != null) form.append(k, String(v));
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVideoNote`, { method: 'POST', body: form });
  const data = await response.json();
  if (!data.ok) throw new Error(`Telegram API error [${data.error_code}]: ${data.description}`);
  return data.result;
}

/**
 * Turn the admin's video into a round video and send it back as a preview.
 * Returns { fileId, duration, notes } where fileId is the round video to post.
 * Throws an Error whose message is shown to the admin (in Uzbek).
 */
export async function prepareVideoNote(callApi, adminId, video, replyTo) {
  // Already a round video: Telegram made it, it can be posted as it is.
  if (video.kind === 'video_note') {
    if (video.duration > MAX_SECONDS) throw new Error(`Dumaloq video ${MAX_SECONDS} soniyadan uzun.`);
    const sent = await callApi('sendVideoNote', { chat_id: adminId, video_note: video.file_id, reply_to_message_id: replyTo });
    return { fileId: sent.video_note.file_id, duration: video.duration, notes: [] };
  }

  if ((video.file_size || 0) > MAX_DOWNLOAD) {
    throw new Error(`Fayl juda katta (${(video.file_size / 1048576).toFixed(1)} MB). Bot 20 MB gacha faylni qabul qila oladi: videoni siqib (640×640, 60 soniya) qayta yuboring.`);
  }
  if (!hasFfmpeg()) {
    throw new Error('Bot hozir boshqa postni chiqaryapti. 10 daqiqadan keyin videoni qayta yuboring.');
  }

  const dir = mkdtempSync(join(tmpdir(), 'vnote-'));
  try {
    const input = join(dir, 'in');
    const output = join(dir, 'round.mp4');
    await download(callApi, video.file_id, input);
    const info = probe(input);
    const notes = [];
    if (info.width !== info.height) {
      const side = info.width > info.height ? 'chetlari' : 'tepasi va pasti';
      notes.push(`📐 Video kvadrat emas (${info.width}×${info.height}): o‘rtasi olindi, ${side} kesildi.`);
    }
    if (info.duration > MAX_SECONDS + 0.5) {
      notes.push(`✂️ Video ${Math.round(info.duration)} soniya edi: ${MAX_SECONDS}-soniyada kesildi.`);
    }
    convert(input, output);
    const duration = Math.min(info.duration, MAX_SECONDS);
    console.log(`🎥 Round video ready: ${(statSync(output).size / 1048576).toFixed(1)} MB, ${Math.round(duration)}s`);
    const sent = await uploadVideoNote(adminId, output, duration, { reply_to_message_id: replyTo });
    return { fileId: sent.video_note.file_id, duration, notes };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Post a prepared round video to the channel. */
export async function publishVideoNote(callApi, channelId, fileId) {
  return callApi('sendVideoNote', { chat_id: channelId, video_note: fileId });
}
