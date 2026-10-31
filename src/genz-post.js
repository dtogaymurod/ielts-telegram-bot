/**
 * Short Gen Z style posts — a prepared bank written in advance.
 *
 * Takes the next unused post of today's kind from content/genz-posts.json,
 * renders its poster (poster/render_genz.py) and sends it to the channel.
 * Emoji riddles and "To'g'ri yoki xato?" are followed by a Telegram quiz
 * that stays open, so subscribers can answer whenever they open the channel.
 *
 * Schedule (Tashkent, 12:00):
 *   Tuesday   — upgrade   (Oddiy vs Band 9)
 *   Wednesday — slang     (TikTok vs IELTS)
 *   Friday    — emoji     (Emoji topishmoq + quiz)
 *   Saturday  — truefalse (To'g'ri yoki xato? + quiz)
 *
 * Usage:
 *   node src/genz-post.js                  — post today's kind
 *   node src/genz-post.js --kind emoji     — force a kind
 *   node src/genz-post.js --dry-run        — render the poster, send nothing
 */

import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { sendLocalPhoto, sendQuiz, validateConfig } from './telegram.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POSTS_FILE = join(__dirname, '..', 'content', 'genz-posts.json');
const RENDER_SCRIPT = join(__dirname, '..', 'poster', 'render_genz.py');

const KINDS_BY_DAY = { 2: 'upgrade', 3: 'slang', 5: 'emoji', 6: 'truefalse' };
const FOOTER = ['👉 Telegram: @dilshod_english', '📸 Instagram: instagram.com/dilshod.ustoz'];

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const kindArg = args.includes('--kind') ? args[args.indexOf('--kind') + 1] : process.env.GENZ_KIND;

function pickKind() {
  if (kindArg) return kindArg;
  const tashkentDay = new Date(Date.now() + 5 * 60 * 60 * 1000).getUTCDay();
  return KINDS_BY_DAY[tashkentDay];
}

/** Fill in the fixed title/subtitle for the quiz kinds. */
export function withDefaults(kind, post) {
  const defaults = {
    emoji: { title: 'Bu qaysi so‘z?', subtitle: 'Emojilarga qarab IELTS so‘zini toping' },
    truefalse: { title: 'Sizningcha, bu gap to‘g‘rimi?', subtitle: 'O‘zbek o‘quvchilari ko‘p adashadigan gap' },
  };
  return { kind, ...defaults[kind], ...post };
}

/**
 * The caption complements the poster instead of repeating it: the poster
 * shows the words or the question, the caption adds a rule, an example
 * sentence or a hint (the quiz explanation carries the answer).
 */
export function buildCaption(post) {
  const headers = {
    upgrade: '😎 <b>ODDIY vs BAND 9</b>',
    slang: '📱 <b>TIKTOK vs IELTS</b> 🎓',
    emoji: '🧩 <b>EMOJI TOPISHMOQ</b>',
    truefalse: '🤔 <b>TO‘G‘RI YOKI XATO?</b>',
  };
  const calls = {
    upgrade: "🔖 Saqlab qo'ying va do'stingizga yuboring!",
    slang: '💬 Siz qaysi birini ko‘p ishlatasiz? Izohda yozing 😅',
    emoji: 'Javobingizni pastdagi quizda belgilang 👇',
    truefalse: 'O‘ylab ko‘ring va pastdagi quizda javob bering 👇',
  };
  return [headers[post.kind], '', post.caption, '', calls[post.kind], '', ...FOOTER].join('\n');
}

export function buildQuiz(post) {
  if (post.kind === 'emoji') {
    return {
      question: 'Rasmdagi emojilar qaysi so‘z yoki iborani bildiradi?',
      options: post.options,
      correct: post.answer,
      explanation: post.explanation,
    };
  }
  if (post.kind === 'truefalse') {
    return {
      question: 'Rasmdagi gap to‘g‘rimi?',
      options: ['✅ To‘g‘ri', '❌ Xato'],
      correct: post.correct ? 0 : 1,
      explanation: post.explanation,
    };
  }
  return null;
}

function renderPoster(post) {
  const dir = mkdtempSync(join(tmpdir(), 'genz-'));
  const input = join(dir, 'post.json');
  const output = join(dir, 'poster.png');
  writeFileSync(input, JSON.stringify(post));
  execFileSync('python3', [RENDER_SCRIPT, input, output], { stdio: 'pipe', timeout: 60_000 });
  return output;
}

async function main() {
  const kind = pickKind();
  if (!kind) {
    console.log('ℹ️ No Gen Z post scheduled for today.');
    return;
  }
  const data = JSON.parse(readFileSync(POSTS_FILE, 'utf-8'));
  if (!data[kind]) throw new Error(`Unknown kind "${kind}"`);

  const index = data.next_index[kind] || 0;
  const raw = data[kind][index];
  if (!raw) {
    console.log(`ℹ️ No unused "${kind}" posts left. Add more to content/genz-posts.json.`);
    return;
  }
  const post = withDefaults(kind, raw);
  console.log(`✨ ${kind} post #${index + 1}`);

  const poster = renderPoster(post);
  const caption = buildCaption(post);
  const quiz = buildQuiz(post);
  console.log(`🖼 Poster: ${poster}`);

  if (isDryRun) {
    console.log(`\n${caption}\n`);
    if (quiz) console.log('📊 Quiz:', JSON.stringify(quiz, null, 1));
    console.log('✅ Dry run complete. Nothing published.');
    return;
  }

  validateConfig();
  const photo = await sendLocalPhoto(poster, caption);
  console.log(`✅ Poster published! Message ID: ${photo.message_id}`);
  if (quiz) {
    const poll = await sendQuiz(quiz.question, quiz.options, quiz.correct, quiz.explanation);
    console.log(`✅ Quiz published! Message ID: ${poll.message_id}`);
  }

  data.next_index[kind] = index + 1;
  writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}
