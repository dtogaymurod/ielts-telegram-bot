/**
 * Agent reels with the teacher's own voice.
 *
 * The SMM agents render a silent, subtitled screen reel (smm-agents
 * design/reel.mjs) and queue it in content/agent-queue.json:
 *
 *   { "channel": "ig_ustoz", "format": "reels", "video": "content/agent-media/<date>-<id>.mp4",
 *     "script": "the words on screen, in order: what the teacher reads aloud", "caption": "..." }
 *
 *   21:00  the preview shows the video and the script. The teacher answers
 *          the script message with a voice message (attachVoice): the video is
 *          stretched to the length of the voice (the subtitles keep their
 *          order and share of the time), the voice is laid under it, the
 *          result is shown to the teacher and stored on the mock site. A new
 *          voice message replaces the previous one.
 *   time   the approved reel is put into the mock site's Instagram queue
 *          (publishReel). Without a voice message it goes out silent.
 *
 * Needs ffmpeg (installed in review.yml) and the SMM_KEY secret.
 */

import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MIN_STRETCH = 0.6;
const MAX_STRETCH = 1.8;
const LEAD = 0.3; // silence before the voice starts, seconds
const TAIL = 0.8; // the closing card stays a little after the last word

export function isReelPost(post) {
  return post?.channel === 'ig_ustoz' && post?.format === 'reels';
}

export function isReelDraft(draft) {
  return draft?.meta?.channel === 'ig_ustoz' && draft?.meta?.format === 'reels';
}

function duration(path) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).toString();
  return Number(out.trim()) || 0;
}

async function sendVideo(chatId, path, caption = '') {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('video', new Blob([readFileSync(path)], { type: 'video/mp4' }), 'reel.mp4');
  form.append('supports_streaming', 'true');
  if (caption) { form.append('caption', caption); form.append('parse_mode', 'HTML'); }
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, { method: 'POST', body: form });
  const data = await response.json();
  if (!data.ok) throw new Error(`Telegram API error [${data.error_code}]: ${data.description}`);
  return data.result;
}

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Preview: the silent reel, then the script to read. Returns the id of the script message. */
export async function showReel(callApi, adminId, post, videoPath) {
  await sendVideo(adminId, videoPath);
  const caption = String(post.caption || '');
  if (caption) await callApi('sendMessage', { chat_id: adminId, text: `📝 <b>Caption:</b>\n${esc(caption)}`.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true });
  const prompt = await callApi('sendMessage', {
    chat_id: adminId,
    parse_mode: 'HTML',
    text: [
      '🎙 <b>Ovoz matni</b> (videodagi yozuvlar tartibida):',
      '',
      esc(post.script || ''),
      '',
      'Shu xabarga <b>javob (reply) qilib ovozli xabar</b> yuboring: bir tekis, to‘xtamasdan o‘qing. Bot ovozni videoga qo‘shib, natijani ko‘rsatadi. Yoqmasa, yana bir marta yuboring.',
      'Ovoz yubormasangiz, reels ovozsiz (subtitr bilan) chiqadi.',
    ].join('\n'),
  });
  return prompt.message_id;
}

/** Lay the voice under the reel, stretching the video to the voice's length. */
export function mixVoice(videoPath, voicePath, outPath) {
  const video = duration(videoPath);
  const voice = duration(voicePath);
  if (!video || !voice) throw new Error('video yoki ovoz uzunligini o‘qib bo‘lmadi');
  const wanted = (voice + LEAD + TAIL) / video;
  const stretch = Math.min(MAX_STRETCH, Math.max(MIN_STRETCH, wanted));
  const total = video * stretch;
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-i', videoPath, '-i', voicePath,
    '-filter_complex',
    `[0:v]setpts=${stretch.toFixed(4)}*PTS,fps=30[v];[1:a]adelay=${Math.round(LEAD * 1000)}:all=1,loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]`,
    '-map', '[v]', '-map', '[a]', '-t', total.toFixed(2),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', '-movflags', '+faststart', outPath,
  ], { stdio: 'inherit' });
  return { total, voice, cut: wanted > MAX_STRETCH, maxVoice: video * MAX_STRETCH - LEAD - TAIL };
}

/**
 * The teacher answered with a voice message: mix, show the result, store it
 * on the mock site. `upload(path, name)` returns the public URL. Sets
 * draft.meta.video_url. Throws an Error whose message is shown to the admin.
 */
export async function attachVoice(callApi, adminId, draft, voice, videoPath, upload) {
  const dir = mkdtempSync(join(tmpdir(), 'reel-'));
  try {
    const file = await callApi('getFile', { file_id: voice.file_id });
    const response = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`);
    if (!response.ok) throw new Error(`ovozni yuklab bo‘lmadi (${response.status})`);
    const voicePath = join(dir, 'voice.ogg');
    writeFileSync(voicePath, Buffer.from(await response.arrayBuffer()));
    const out = join(dir, 'reel.mp4');
    const mix = mixVoice(videoPath, voicePath, out);
    draft.meta.video_url = await upload(out, `${draft.meta.agent_id}-voice.mp4`);
    draft.meta.voice_seconds = Math.round(mix.voice);
    const notes = [`🎬 <b>Ovoz qo‘shildi</b> (${Math.round(mix.total)} soniya). Yoqsa, yuqoridagi ✅ ni bosing. Yoqmasa, ovozni qayta yuboring.`];
    if (mix.cut) notes.push(`⚠️ Ovoz uzun bo‘lib, oxiri kesildi. ${Math.floor(mix.maxVoice)} soniyagacha qilib qayta yuboring.`);
    await sendVideo(adminId, out, notes.join('\n'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
