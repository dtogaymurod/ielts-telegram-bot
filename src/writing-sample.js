/**
 * IELTS Writing Sample poster — weekly Band 8+ Task 1 / Task 2 samples.
 *
 * Takes the next prepared sample from content/writing-samples.json,
 * publishes the full answer (useful vocabulary in bold + Uzbek glossary)
 * as a Telegraph page, and posts a branded poster with a link to it.
 *
 * Usage:
 *   node src/writing-sample.js              — post (Task 1 on Monday, Task 2 otherwise)
 *   node src/writing-sample.js --task 1     — force Task 1 or 2
 *   node src/writing-sample.js --dry-run    — build everything, send nothing
 */

import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { sendLocalPhoto, validateConfig } from './telegram.js';
import { createPage, inlineNodes } from './telegraph.js';
import { captionLength, CAPTION_LIMIT } from './poster.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLES_FILE = join(__dirname, '..', 'content', 'writing-samples.json');
const RENDER_SCRIPT = join(__dirname, '..', 'poster', 'render_writing.py');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
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

export function buildPageContent(sample) {
  const words = wordCount(sample.answer);
  return [
    { tag: 'h4', children: [`📝 Writing Task ${sample.task} · Savol`] },
    { tag: 'blockquote', children: [sample.question] },
    ...(sample.task === 1 ? [{ tag: 'p', children: [{ tag: 'em', children: ['Grafik kanaldagi postda.'] }] }] : []),
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
    `📖 <b><a href="${url}">Band 8+ namuna javobni o'qish →</a></b>`,
    `💡 Foydali so'zlar <b>bold</b> qilingan, oxirida ${sample.vocabulary.length} tasi o'zbekcha tarjimasi bilan.`,
    '',
    '👉 Telegram: @dilshod_english',
    '📸 Instagram: instagram.com/dilshod.ustoz',
  ].join('\n');
}

function renderPoster(sample) {
  const dir = mkdtempSync(join(tmpdir(), 'writing-'));
  const input = join(dir, 'sample.json');
  const output = join(dir, 'poster.png');
  writeFileSync(input, JSON.stringify(sample));
  execFileSync('python3', [RENDER_SCRIPT, input, output], { stdio: 'pipe', timeout: 60_000 });
  return output;
}

async function main() {
  const task = pickTask();
  const data = JSON.parse(readFileSync(SAMPLES_FILE, 'utf-8'));
  const queue = data.samples.filter((s) => s.task === task);
  const index = data.next_index[task] || 0;
  const sample = queue[index];

  if (!sample) {
    console.log(`ℹ️ No unused Writing Task ${task} samples left. Add more to content/writing-samples.json.`);
    return;
  }
  console.log(`✍️ Writing Task ${task} sample #${index + 1}: ${sample.title}`);

  if (!isDryRun) validateConfig();

  const posterPath = renderPoster(sample);
  console.log(`🖼 Poster: ${posterPath}`);

  if (isDryRun) {
    console.log(JSON.stringify(buildPageContent(sample), null, 1).slice(0, 1500));
    const caption = buildCaption(sample, 'https://telegra.ph/preview');
    console.log(`\n${caption}\n\n📏 Caption: ${captionLength(caption)} / ${CAPTION_LIMIT}`);
    console.log('✅ Dry run complete. Nothing published.');
    return;
  }

  const url = await createPage(`${sample.title} | IELTS Writing Task ${task} Band 8+`, buildPageContent(sample));
  console.log(`📄 Telegraph page: ${url}`);

  const result = await sendLocalPhoto(posterPath, buildCaption(sample, url));
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
