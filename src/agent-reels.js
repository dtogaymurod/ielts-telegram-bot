/**
 * Agent reels with the teacher's own voice.
 *
 * The SMM agents render a silent, subtitled screen reel (smm-agents
 * design/reel.mjs) and queue it in content/agent-queue.json:
 *
 *   { "channel": "ig_ustoz", "format": "reels", "video": "content/agent-media/<date>-<id>.mp4",
 *     "script": "the words on screen, one line per scene: what the teacher reads aloud",
 *     "segments": [2730, 3220, ...], "caption": "..." }
 *
 *   21:00  the preview shows the video and the script. The teacher answers
 *          the script message with a voice message (attachVoice): every scene
 *          of the video is stretched to the sentence the teacher is saying
 *          (mixVoice: pauses in the voice show where each script line starts;
 *          needs "segments", the scene lengths written by reel.mjs), the
 *          voice is laid under it, the
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
      'Shu xabarga <b>javob (reply) qilib ovozli xabar</b> yuboring: har qatordan keyin qisqa to‘xtab o‘qing (sahnalar gaplaringizga moslanadi). Bot ovozni videoga qo‘shib, natijani ko‘rsatadi. Yoqmasa, yana bir marta yuboring.',
      'Ovoz yubormasangiz, reels ovozsiz (subtitr bilan) chiqadi.',
    ].join('\n'),
  });
  return prompt.message_id;
}

/** Pauses in the voice: [{ start, end }] in seconds, plus where speech starts and ends. */
export function voicePauses(voicePath) {
  const total = duration(voicePath);
  // ffmpeg writes its report to stderr; execFileSync returns stdout, so read stderr through a wrapper
  const report = (filter) => execFileSync('sh', ['-c', 'ffmpeg -hide_banner -nostats -i "$1" -af "$2" -f null - 2>&1', 'sh', voicePath, filter], { encoding: 'utf-8' });
  // a fixed gain to a common peak first, so the threshold means the same for a quiet and a loud recording
  const peak = Number((report('volumedetect').match(/max_volume: (-?[\d.]+) dB/) || [])[1] || 0);
  return parsePauses(report(`volume=${(-1 - peak).toFixed(1)}dB,silencedetect=noise=-32dB:d=0.18`), total);
}

export function parsePauses(log, total) {
  const starts = [...log.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Math.max(0, Number(m[1])));
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  let all = [];
  starts.forEach((start, i) => {
    const end = ends[i] ?? total;
    const last = all[all.length - 1];
    if (last && start - last.end < 0.1) last.end = end; // one pause split by a click
    else all.push({ start, end });
  });
  let from = 0;
  let to = total;
  if (all.length && all[0].start < 0.05) from = all.shift().end;
  // a breath or a click before the first word: under 0.3 s of sound, then a long silence
  while (all.length && all[0].start - from < 0.3 && all[0].end - all[0].start > 0.4) from = all.shift().end;
  if (all.length && all[all.length - 1].end > total - 0.05) to = all.pop().start;
  return { from, to, pauses: all.filter((p) => p.start > from && p.end < to) };
}

/**
 * Where each script line starts in the voice (seconds). The teacher reads the
 * lines in order, so every line should take about its share of the letters.
 * Of all ways to pick one pause between each two lines, the one where the
 * lines fit their shares best wins; longer pauses count for a little, because
 * the pause between two lines is longer than one inside a line.
 */
export function lineStarts(lines, { from, to, pauses }) {
  const sizes = lines.map((line) => Math.max(1, String(line).replace(/\s+/g, ' ').trim().length));
  const sum = sizes.reduce((a, b) => a + b, 0);
  const share = sizes.map((s) => (to - from) * s / sum);
  const n = lines.length;
  if (pauses.length < n - 1) { // too few pauses: fall back to the shares
    const starts = [from];
    for (let i = 1; i < n; i++) starts.push(starts[i - 1] + share[i - 1]);
    return starts;
  }
  const fit = (i, length) => ((length - share[i]) / share[i]) ** 2;
  // best[i][j]: lowest cost with line i starting at the end of pause j
  let best = pauses.map((p) => ({ cost: fit(0, p.start - from) - (p.end - p.start) * 0.5, path: [] }));
  best.forEach((b, j) => { b.path = [j]; });
  for (let i = 2; i < n; i++) {
    best = pauses.map((p, j) => {
      let pick = null;
      for (let k = 0; k < j; k++) {
        if (!best[k]) continue;
        const cost = best[k].cost + fit(i - 1, p.start - pauses[k].end) - (p.end - p.start) * 0.5;
        if (!pick || cost < pick.cost) pick = { cost, path: [...best[k].path, j] };
      }
      return pick;
    });
  }
  let winner = null;
  best.forEach((b, j) => {
    if (!b) return;
    const cost = b.cost + fit(n - 1, to - pauses[j].end);
    if (!winner || cost < winner.cost) winner = { cost, path: b.path };
  });
  return [from, ...winner.path.map((j) => pauses[j].end)];
}

/**
 * Lay the voice under the reel. With `segments` (the length of every scene in
 * the silent video, ms) and the script lines, every scene is stretched to the
 * sentence the teacher is saying, so the picture changes when he starts the
 * next line. Without them the whole video is stretched evenly.
 */
export function mixVoice(videoPath, voicePath, outPath, { segments = [], lines = [] } = {}) {
  const video = duration(videoPath);
  const voice = duration(voicePath);
  if (!video || !voice) throw new Error('video yoki ovoz uzunligini o‘qib bo‘lmadi');
  if (segments.length >= 2 && segments.length === lines.length) {
    try { return mixSynced(videoPath, voicePath, outPath, segments, lines, video, voice); } catch (error) { console.log(`⚠️ Synced mix failed, mixing evenly: ${error.message}`); }
  }
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
  return { total, voice, cut: wanted > MAX_STRETCH, maxVoice: video * MAX_STRETCH - LEAD - TAIL, synced: false };
}

const SCENE_EARLY = 0.12; // the picture changes just before the sentence starts
const MIN_SCENE = 0.45;
const MAX_SCENE = 3;

function mixSynced(videoPath, voicePath, outPath, segments, lines, video, voice) {
  const found = voicePauses(voicePath);
  if (found.to - found.from < 1) throw new Error('no speech found');
  const starts = lineStarts(lines, found);
  // voice time → reel time: the silence before the first word is cut down to LEAD
  const shift = found.from - LEAD;
  const cuts = starts.slice(1).map((s) => s - shift - SCENE_EARLY);
  const end = found.to - shift + TAIL;
  const targets = [...cuts, end].map((t, i, a) => t - (i ? a[i - 1] : 0));
  const scale = video / (segments.reduce((a, b) => a + b, 0) / 1000); // the file may differ a little from the plan
  let at = 0;
  const parts = segments.map((ms, i) => {
    const from = at;
    at += (ms / 1000) * scale;
    const to = i === segments.length - 1 ? video : at;
    const factor = Math.min(MAX_SCENE, Math.max(MIN_SCENE, targets[i] / (to - from)));
    return `[0:v]trim=start=${from.toFixed(3)}:end=${to.toFixed(3)},setpts=${factor.toFixed(4)}*(PTS-STARTPTS)[s${i}]`;
  });
  const total = targets.reduce((a, b) => a + b, 0);
  const audio = shift >= 0
    ? `[1:a]atrim=start=${shift.toFixed(3)},asetpts=PTS-STARTPTS,loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]`
    : `[1:a]adelay=${Math.round(-shift * 1000)}:all=1,loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]`;
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-i', videoPath, '-i', voicePath,
    '-filter_complex',
    `${parts.join(';')};${segments.map((_, i) => `[s${i}]`).join('')}concat=n=${segments.length}:v=1:a=0,fps=30[v];${audio}`,
    '-map', '[v]', '-map', '[a]', '-t', total.toFixed(2),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', '-movflags', '+faststart', outPath,
  ], { stdio: 'inherit' });
  return { total, voice, cut: false, maxVoice: 0, synced: true, starts };
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
    const lines = String(draft.meta.script || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const mix = mixVoice(videoPath, voicePath, out, { segments: draft.meta.segments || [], lines });
    draft.meta.video_url = await upload(out, `${draft.meta.agent_id}-voice.mp4`);
    draft.meta.voice_seconds = Math.round(mix.voice);
    const notes = [`🎬 <b>Ovoz qo‘shildi</b>${mix.synced ? ' va sahnalar gaplaringizga moslandi' : ''} (${Math.round(mix.total)} soniya). Yoqsa, yuqoridagi ✅ ni bosing. Yoqmasa, ovozni qayta yuboring.`];
    if (mix.cut) notes.push(`⚠️ Ovoz uzun bo‘lib, oxiri kesildi. ${Math.floor(mix.maxVoice)} soniyagacha qilib qayta yuboring.`);
    await sendVideo(adminId, out, notes.join('\n'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
