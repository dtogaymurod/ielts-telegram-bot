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
 * Premium reels (2026-11-17, the teacher rejected the stretched "pop" mix as
 * cartoonish): when the queue entry carries "reel_spec", the reel is rendered
 * again around the voice (reels/audio/build_reel.py, a copy of smm-agents
 * design/): the voice is cleaned and tightened, every scene and every subtitle
 * word follows the teacher's words, and a calm music bed ducks under the
 * voice. The tools it needs (playwright, chromium, pocketsphinx) are installed
 * on the first voice message of a run. If anything fails, the old mix is used,
 * now with the same voice cleaning.
 *
 * Needs ffmpeg (installed in review.yml) and the SMM_KEY secret.
 */

import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
// the teacher's voice: rumble, noise and the muffled 200-500 Hz go, clarity and air come in, then an even level
export const VOICE_CHAIN = 'highpass=f=85,highpass=f=85,afftdn=nf=-42:nr=8:tn=1,equalizer=f=220:t=q:w=1.1:g=-4,equalizer=f=500:t=q:w=1.4:g=-1.5,'
  + 'equalizer=f=3400:t=q:w=1.3:g=4,equalizer=f=6800:t=q:w=1.4:g=2.5,highshelf=f=10000:g=2,deesser=i=0.35,'
  + 'acompressor=threshold=-22dB:ratio=3.2:attack=6:release=110:makeup=5,alimiter=limit=0.89';

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

export async function sendVideo(chatId, path, caption = '', markup = null) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('video', new Blob([readFileSync(path)], { type: 'video/mp4' }), 'reel.mp4');
  form.append('supports_streaming', 'true');
  // Telegram shows a video without these as a square: tell it the real size
  try {
    const info = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', path]).toString();
    const meta = JSON.parse(info);
    const s = meta.streams?.[0] || {};
    if (s.width && s.height) { form.append('width', String(s.width)); form.append('height', String(s.height)); }
    const d = Math.round(Number(meta.format?.duration) || 0);
    if (d) form.append('duration', String(d));
  } catch { /* ffprobe missing: Telegram guesses */ }
  if (caption) { form.append('caption', caption); form.append('parse_mode', 'HTML'); }
  if (markup) form.append('reply_markup', JSON.stringify(markup));
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
    `[0:v]setpts=${stretch.toFixed(4)}*PTS,fps=30[v];[1:a]${VOICE_CHAIN},adelay=${Math.round(LEAD * 1000)}:all=1,loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]`,
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
    ? `[1:a]atrim=start=${shift.toFixed(3)},asetpts=PTS-STARTPTS,${VOICE_CHAIN},loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]`
    : `[1:a]${VOICE_CHAIN},adelay=${Math.round(-shift * 1000)}:all=1,loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]`;
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

let toolsReady = false;
/** playwright + chromium + pocketsphinx for the premium render, once per run. */
function premiumTools() {
  if (toolsReady) return;
  const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', timeout: 6 * 60 * 1000 });
  try { execFileSync('python3', ['-c', 'import pocketsphinx, numpy'], { stdio: 'ignore' }); } catch { run('python3', ['-m', 'pip', 'install', '-q', 'pocketsphinx', 'numpy']); }
  try { execFileSync('node', ['-e', "require.resolve('playwright')"], { cwd: ROOT, stdio: 'ignore' }); } catch { run('npm', ['install', '--no-save', '--no-audit', '--no-fund', 'playwright@1.49.1']); }
  run('npx', ['playwright', 'install', '--with-deps', 'chromium']);
  toolsReady = true;
}

/** The premium reel, rendered again around the teacher's voice. */
export function renderPremium(spec, voicePath, outPath) {
  premiumTools();
  const dir = mkdtempSync(join(tmpdir(), 'reelspec-'));
  try {
    const specPath = join(dir, 'spec.json');
    writeFileSync(specPath, JSON.stringify({ ...spec, style: 'premium' }));
    execFileSync('python3', [join(ROOT, 'reels', 'audio', 'build_reel.py'), specPath, voicePath, outPath], { cwd: ROOT, stdio: 'inherit', timeout: 10 * 60 * 1000 });
    return { total: duration(outPath), voice: duration(voicePath), cut: false, maxVoice: 0, synced: true, premium: true };
  } finally { rmSync(dir, { recursive: true, force: true }); }
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
    let mix = null;
    if (draft.meta.reel_spec) {
      try { mix = renderPremium(draft.meta.reel_spec, voicePath, out); } catch (error) { console.log(`⚠️ Premium render failed, mixing the old way: ${error.message}`); }
    }
    if (!mix) mix = mixVoice(videoPath, voicePath, out, { segments: draft.meta.segments || [], lines });
    draft.meta.video_url = await upload(out, `${draft.meta.agent_id}-voice.mp4`);
    draft.meta.voice_seconds = Math.round(mix.voice);
    const notes = [`🎬 <b>Ovoz qo‘shildi</b>${mix.premium ? ': ovoz tozalandi, sahnalar va subtitr gaplaringizga moslandi, fon musiqa qo‘yildi' : mix.synced ? ' va sahnalar gaplaringizga moslandi' : ''} (${Math.round(mix.total)} soniya). Yoqsa, yuqoridagi ✅ ni bosing. Yoqmasa, ovozni qayta yuboring.`];
    if (mix.cut) notes.push(`⚠️ Ovoz uzun bo‘lib, oxiri kesildi. ${Math.floor(mix.maxVoice)} soniyagacha qilib qayta yuboring.`);
    await sendVideo(adminId, out, notes.join('\n'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/*
 * Camera reels (2026-11-18): the teacher asked that reels show only him, not
 * generated screens. The agents queue the script with "camera": true and no
 * video; at 21:00 the bot sends the script ("Kamera matni"). The teacher
 * answers it with a vertical video of himself reading it. The bot cuts the
 * long pauses, cleans the voice, adds word-by-word subtitles and a calm music
 * bed (reels/audio/camera_reel.py), shows the result and stores it on the mock
 * site. Without a video the reel does not go out.
 */

/** Preview of a camera reel: the caption, then the script to film. Returns the script message id. */
export async function showCameraReel(callApi, adminId, post) {
  const caption = String(post.caption || '');
  if (caption) await callApi('sendMessage', { chat_id: adminId, text: `📝 <b>Caption:</b>\n${esc(caption)}`.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true });
  const prompt = await callApi('sendMessage', {
    chat_id: adminId,
    parse_mode: 'HTML',
    text: [
      '🎥 <b>Kamera matni</b> (reels: kadrda faqat siz):',
      '',
      esc(post.script || ''),
      '',
      'Telefonni <b>tik (vertikal)</b> ushlab, yuzingiz yorug‘ tomonda bo‘lsin, kameraga qarab o‘qing. 20–45 soniya.',
      'Shu xabarga <b>javob (reply) qilib videoni</b> yuboring. Bot pauzalarni qisqartiradi, ovozni tozalaydi, subtitr va fon musiqa qo‘yib natijani ko‘rsatadi. Yoqmasa, qayta yuboring.',
      'Video kelmasa, bu reels chiqmaydi.',
    ].join('\n'),
  });
  return prompt.message_id;
}

let cameraReady = false;
function cameraTools() {
  if (cameraReady) return;
  try { execFileSync('python3', ['-c', 'import pocketsphinx, numpy'], { stdio: 'ignore' }); } catch {
    execFileSync('python3', ['-m', 'pip', 'install', '-q', 'pocketsphinx', 'numpy'], { cwd: ROOT, stdio: 'inherit', timeout: 6 * 60 * 1000 });
  }
  cameraReady = true;
}

/**
 * The teacher's video for a camera reel: edit, show, store. Sets
 * draft.meta.video_url. Throws an Error whose message is shown to the admin.
 */
export async function attachCamera(callApi, adminId, draft, video, upload) {
  if (video.file_size && video.file_size > 20 * 1024 * 1024) {
    throw new Error('video 20 MB dan katta (Telegram botga shundan kattasini bermaydi). Videoni "fayl" emas, oddiy video qilib yuboring yoki qisqaroq yozing.');
  }
  const dir = mkdtempSync(join(tmpdir(), 'camreel-'));
  try {
    cameraTools();
    const file = await callApi('getFile', { file_id: video.file_id });
    const response = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`);
    if (!response.ok) throw new Error(`videoni yuklab bo‘lmadi (${response.status})`);
    const src = join(dir, 'camera.mp4');
    writeFileSync(src, Buffer.from(await response.arrayBuffer()));
    const scriptPath = join(dir, 'script.txt');
    writeFileSync(scriptPath, String(draft.meta.script || '').trim() + '\n');
    const out = join(dir, 'reel.mp4');
    const args = [join(ROOT, 'reels', 'audio', 'camera_reel.py'), src, scriptPath, out];
    if (draft.meta.hook) args.push('--hook', String(draft.meta.hook));
    execFileSync('python3', args, { cwd: ROOT, stdio: 'inherit', timeout: 10 * 60 * 1000 });
    let info = {};
    try { info = JSON.parse(readFileSync(`${out}.json`, 'utf-8')); } catch {}
    draft.meta.video_url = await upload(out, `${draft.meta.agent_id}-camera.mp4`);
    const notes = [`🎬 <b>Reels tayyor</b> (${Math.round(info.dur || duration(out))} soniya): pauzalar qisqardi${info.cut_seconds ? ` (−${info.cut_seconds} s)` : ''}, ovoz tozalandi, subtitr va fon musiqa qo‘yildi. Yoqsa, yuqoridagi ✅ ni bosing. Yoqmasa, videoni qayta yuboring.`];
    if (info.aligned === false) notes.push('ℹ️ Subtitr gaplaringizga taxminan moslandi: matndan chetga chiqqan bo‘lsangiz, biroz oldin-keyin bo‘lishi mumkin.');
    await sendVideo(adminId, out, notes.join('\n'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
