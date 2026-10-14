/**
 * IELTS Writing Sample poster — weekly Band 8+ Task 1 / Task 2 samples.
 *
 * Takes the next prepared sample from content/writing-samples.json,
 * publishes the full answer (useful vocabulary in bold + Uzbek glossary)
 * as a Telegraph page headed by the branded poster, and posts a message
 * whose large link preview shows the poster with Telegram's INSTANT VIEW
 * button, so the answer opens inside Telegram.
 *
 * Posters live in posters/writing/<id>.png and are served from GitHub
 * (raw.githubusercontent.com), so they must be committed before posting.
 *
 * Usage:
 *   node src/writing-sample.js              — post (Task 1 on Monday, Task 2 otherwise)
 *   node src/writing-sample.js --task 1     — force Task 1 or 2
 *   node src/writing-sample.js --dry-run    — build everything, send nothing
 *   node src/writing-sample.js --render     — render missing posters into posters/writing
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { sendMessage, validateConfig } from './telegram.js';
import { createPage, inlineNodes } from './telegraph.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLES_FILE = join(__dirname, '..', 'content', 'writing-samples.json');
const RENDER_SCRIPT = join(__dirname, '..', 'poster', 'render_writing.py');
const POSTER_DIR = join(__dirname, '..', 'posters', 'writing');
const REPO = process.env.GITHUB_REPOSITORY || 'dtogaymurod/ielts-telegram-bot';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isRenderOnly = args.includes('--render');
const taskArg = args.includes('--task') ? args[args.indexOf('--task') + 1] : process.env.WRITING_TASK;

function pickTask() {
  if (taskArg === '1' || taskArg === '2') return Number(taskArg);
  const tashkentDay = new Date(Date.now() + 5 * 60 * 60 * 1000).getUTCDay();
  return tashkentDay === 1 ? 1 : 2; // Monday: Task 1, otherwise Task 2
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function wordCount(paragraphs) {
  return paragraphs.join(' ').replace(/\*\*/g, '').trim().split(/\s+/).length;
}

export function posterUrl(sample) {
  return `https://raw.githubusercontent.com/${REPO}/main/posters/writing/${sample.id}.png`;
}

export function buildPageContent(sample) {
  const words = wordCount(sample.answer);
  return [
    { tag: 'figure', children: [{ tag: 'img', attrs: { src: posterUrl(sample) } }] },
    { tag: 'h4', children: [`📝 Writing Task ${sample.task} · Savol`] },
    { tag: 'blockquote', children: [sample.question] },
    { tag: 'h3', children: [`✅ Band 8+ Sample Answer (${words} words)`] },
    ...sample.answer.map((p) => ({ tag: 'p', children: inlineNodes(p) })),
    { tag: 'hr' },
    { tag: 'h3', children: ["📚 Foydali so'zlar"] },
    {
      tag: 'ul',
      children: sample.vocabulary.map(([word, uz]) => ({
        tag: 'li',
        children: [{ tag: 'strong', children: [word] }, ` — ${uz}`],
      })),
    },
    { tag: 'hr' },
    {
      tag: 'p',
      children: [
        "Ko'proq namunalar va IELTS sirlari: ",
        { tag: 'a', attrs: { href: 'https://t.me/dilshod_english' }, children: ['@dilshod_english'] },
      ],
    },
  ];
}

export function buildCaption(sample, url) {
  const label = sample.task === 1 ? 'WRITING TASK 1' : `WRITING TASK 2 | ${sample.type}`;
  return [
    `✍️ <b>IELTS ${escapeHtml(label)}</b>`,
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `📝 <b>Savol:</b> <i>${escapeHtml(sample.question)}</i>`,
    '',
    `📖 <b>Band 8+ namuna javob:</b> pastdagi <b>INSTANT VIEW</b> tugmasini bosing 👇`,
    `💡 Foydali so'zlar <b>bold</b> qilingan, oxirida ${sample.vocabulary.length} tasi o'zbekcha tarjimasi bilan.`,
    '',
    '👉 Telegram: @dilshod_english',
    '📸 Instagram: instagram.com/dilshod.ustoz',
    '',
    `<a href="${url}">📄 Namuna javob</a>`,
  ].join('\n');
}

function renderPoster(sample, output) {
  const input = join(mkdtempSync(join(tmpdir(), 'writing-')), 'sample.json');
  writeFileSync(input, JSON.stringify(sample));
  execFileSync('python3', [RENDER_SCRIPT, input, output], { stdio: 'pipe', timeout: 60_000 });
  return output;
}

function renderMissingPosters(samples) {
  mkdirSync(POSTER_DIR, { recursive: true });
  for (const sample of samples) {
    const output = join(POSTER_DIR, `${sample.id}.png`);
    if (!existsSync(output)) {
      renderPoster(sample, output);
      console.log(`🖼 Rendered ${output}`);
    }
  }
}

async function main() {
  const data = JSON.parse(readFileSync(SAMPLES_FILE, 'utf-8'));
  if (isRenderOnly) {
    renderMissingPosters(data.samples);
    return;
  }

  const task = pickTask();
  const queue = data.samples.filter((s) => s.task === task);
  const index = data.next_index[task] || 0;
  const sample = queue[index];

  if (!sample) {
    console.log(`ℹ️ No unused Writing Task ${task} samples left. Add more to content/writing-samples.json.`);
    return;
  }
  console.log(`✍️ Writing Task ${task} sample #${index + 1}: ${sample.title}`);

  if (!isDryRun) validateConfig();

  if (!existsSync(join(POSTER_DIR, `${sample.id}.png`))) {
    throw new Error(`Poster ${sample.id}.png is missing: run --render and commit posters/writing first`);
  }
  console.log(`🖼 Poster: ${posterUrl(sample)}`);

  if (isDryRun) {
    console.log(JSON.stringify(buildPageContent(sample), null, 1).slice(0, 1500));
    console.log(`\n${buildCaption(sample, 'https://telegra.ph/preview')}`);
    console.log('✅ Dry run complete. Nothing published.');
    return;
  }

  const url = await createPage(`${sample.title} | IELTS Writing Task ${task} Band 8+`, buildPageContent(sample));
  console.log(`📄 Telegraph page: ${url}`);

  // A text message with a large preview of the Telegraph page: Telegram shows
  // the poster (the page's first image) and an INSTANT VIEW button under it.
  const result = await sendMessage(buildCaption(sample, url), {
    extra: {
      disable_web_page_preview: undefined,
      link_preview_options: { url, prefer_large_media: true, show_above_text: true },
    },
  });
  console.log(`✅ Published! Message ID: ${result.message_id}`);

  sample.telegraph_url = url;
  data.next_index[task] = index + 1;
  writeFileSync(SAMPLES_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// Run only when called directly (not when imported for previews/tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}
