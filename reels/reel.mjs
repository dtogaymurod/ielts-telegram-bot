// Ekran yozuvli reels (1080×1920 MP4, ovozsiz, subtitr bilan): haqiqiy imtihon ekrani ustida yurib ko'rsatadi.
//   node design/reel.mjs spec.json out.mp4
// spec.json: { "kicker": "CD IELTS · Listening", "hook": "Matn, <u>ajratilgan</u>",
//   "beats": [ { "focus": "timer" | "audio" | "answers" | "header" | "full", "text": "Subtitr, <b>ajratilgan</b>" }, ... ],   (3–4 ta)
//   "cta": "See this screen before exam day.", "cta2": "Mock Set · 29 000 so'm in the bot", "handle": "@tddmockbot", "screen": "listening-screen.jpg" }
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, rmSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { execFileSync, spawn } from 'child_process';
import { tmpdir } from 'os';

const here = dirname(fileURLToPath(import.meta.url));
const [specPath, outPath] = process.argv.slice(2);
if (!specPath || !outPath) { console.error('usage: node design/reel.mjs spec.json out.mp4'); process.exit(1); }
const spec = JSON.parse(readFileSync(specPath, 'utf-8'));
const screen = join(here, 'assets', spec.screen || 'listening-screen.jpg');
if (!existsSync(screen)) { console.error(`no such screen: ${screen}`); process.exit(1); }
if (!Array.isArray(spec.beats) || spec.beats.length < 2 || spec.beats.length > 5) { console.error('beats: 2–5 ta'); process.exit(1); }

const dir = mkdtempSync(join(tmpdir(), 'reel-'));
const page0 = join(here, `.reel-${process.pid}.html`);
const style = spec.style || 'premium';   // ustoz 2026-11-17: pop multfilmga o'xşaydi, standart premium
writeFileSync(page0, readFileSync(join(here, { premium: 'reel-premium.html', pop: 'reel-pop.html', '3d': 'reel-3d.html', plain: 'reel.html' }[style] || 'reel-premium.html'), 'utf-8')
  .replace('<script>', `<script>window.SPEC=${JSON.stringify({ ...spec, screen: `file://${screen}` }).replace(/</g, '\\u003c')};</script><script>`));
try {
  const { chromium } = createRequire(import.meta.url)('playwright');
  const browser = await chromium.launch();
  const size = { width: 1080, height: 1920 };
  let segments, total;
  if (style === 'pop' || style === 'premium') {
    // kadrma-kadr: har kadr renderAt(t) bilan chizilib suratga olinadi, shuning uchun video qotmaydi
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    await page.goto(`file://${page0}`);
    await page.waitForFunction(() => document.getElementById('img').complete && document.fonts.status === 'loaded');
    await page.evaluate(() => Promise.all(['800 40px "Plus Jakarta Sans"', '700 40px "Inter Display"', '700 40px Inter'].map((f) => document.fonts.load(f).catch(() => null))));
    await page.evaluate(() => window.prepare());
    [segments, total] = await page.evaluate(() => [window.SEGMENTS, window.TOTAL]);
    const fps = 30, frames = Math.round(total / 1000 * fps);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', ...(spec.audio ? ['-i', resolve(dirname(specPath), spec.audio)] : ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo']),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', spec.audio ? '192k' : '96k', '-shortest', '-movflags', '+faststart', resolve(outPath)], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((ok, bad) => ff.on('close', (code) => (code ? bad(new Error(`ffmpeg ${code}`)) : ok())));
    for (let i = 0; i < frames; i++) {
      await page.evaluate((ms) => window.renderAt(ms), i * 1000 / fps);
      const shot = await page.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(shot)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await done; await browser.close();
  } else {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, recordVideo: { dir, size } });
  const page = await context.newPage();
  const t0 = Date.now();
  await page.goto(`file://${page0}`);
  await page.waitForFunction(() => document.getElementById('img').complete && document.fonts.status === 'loaded');
  await page.waitForTimeout(600);
  const lead = (Date.now() - t0) / 1000;
  segments = await page.evaluate(() => window.SEGMENTS);
  total = await page.evaluate(() => { window.start(); return window.TOTAL; });
  await page.waitForTimeout(total + 400);
  await context.close(); await browser.close();
  const webm = join(dir, readdirSync(dir).find((f) => f.endsWith('.webm')));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', lead.toFixed(2), '-i', webm, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
    '-t', (total / 1000).toFixed(2), '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', resolve(outPath)]);
  }
  // ustoz ovoz chiqarib o'qiydigan matn: ekrandagi yozuvlar tartibida
  const plain = (t) => String(t || '').replace(/<[^>]+>/g, '').trim();
  const script = [spec.hook, ...spec.beats.map((b) => b.text), spec.cta].map(plain).filter(Boolean).join('\n');
  writeFileSync(`${resolve(outPath)}.script.txt`, `${script}\n`);
  // har bo'lak uzunligi (ms): bot ovozni shu bo'laklarga moslaydi (navbatda "segments")
  writeFileSync(`${resolve(outPath)}.segments.json`, `${JSON.stringify(segments)}\n`);
  console.log(`ok ${outPath} ${(total / 1000).toFixed(1)}s, script: ${outPath}.script.txt`);
} finally { rmSync(page0, { force: true }); rmSync(dir, { recursive: true, force: true }); }
