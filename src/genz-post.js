/**
 * Daily 12:00 posts — a prepared bank written in advance (content/genz-posts.json).
 *
 * Each day has one or two kinds; two kinds alternate week by week. Formats
 * are mixed on purpose so the feed doesn't look the same every day:
 * poster, poster + quiz, two-slide album, text only, poll only, quiz series.
 *
 * Schedule (Tashkent, 12:00):
 *   Monday    — band (Band 5 vs 8 album)     ⇄ redflag (Red flag / Green flag)
 *   Tuesday   — upgrade (Oddiy vs Band 9)
 *   Wednesday — slang (TikTok vs IELTS)      ⇄ pov (text only)
 *   Thursday  — collocation (+ quiz)          ⇄ poll (poll only)
 *   Friday    — emoji (+ quiz)
 *   Saturday  — truefalse (+ quiz)
 *   Sunday    — weekly (5 quizzes built from the latest posts)
 *
 * Usage:
 *   node src/genz-post.js                  — post today's kind
 *   node src/genz-post.js --kind emoji     — force a kind
 *   node src/genz-post.js --dry-run        — render everything, send nothing
 */

import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { sendLocalAlbum, sendLocalPhoto, sendMessage, sendPoll, sendQuiz, validateConfig } from './telegram.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POSTS_FILE = join(__dirname, '..', 'content', 'genz-posts.json');
const RENDER_SCRIPT = join(__dirname, '..', 'poster', 'render_genz.py');

const KINDS_BY_DAY = {
  0: ['weekly'],
  1: ['band', 'redflag'],
  2: ['upgrade'],
  3: ['slang', 'pov'],
  4: ['collocation', 'poll'],
  5: ['emoji'],
  6: ['truefalse'],
};
const FOOTER = ['👉 Telegram: @dilshod_english', '📸 Instagram: instagram.com/dilshod.ustoz'];

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const kindArg = args.includes('--kind') ? args[args.indexOf('--kind') + 1] : process.env.GENZ_KIND;

function tashkentNow() {
  return new Date(Date.now() + 5 * 60 * 60 * 1000);
}

/** Weeks since Monday 1970-01-05, in Tashkent time: alternates the paired kinds. */
export function weekNumber(date = tashkentNow()) {
  return Math.floor((date.getTime() - Date.UTC(1970, 0, 5)) / (7 * 24 * 60 * 60 * 1000));
}

function pickKind() {
  if (kindArg && kindArg !== 'auto') return kindArg;
  const kinds = KINDS_BY_DAY[tashkentNow().getUTCDay()];
  return kinds[weekNumber() % kinds.length];
}

/** Fill in the fixed title/subtitle for the kinds that share one. */
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
    redflag: '🚩 <b>RED FLAG / GREEN FLAG</b> 🟢',
    collocation: '🧩 <b>MAKE, DO YOKI TAKE?</b>',
    band: '📈 <b>BAND 5 vs BAND 8</b>',
  };
  const calls = {
    upgrade: "🔖 Saqlab qo'ying va do'stingizga yuboring!",
    slang: '💬 Siz qaysi birini ko‘p ishlatasiz? Izohda yozing 😅',
    emoji: 'Javobingizni pastdagi quizda belgilang 👇',
    truefalse: 'O‘ylab ko‘ring va pastdagi quizda javob bering 👇',
    redflag: '💬 Nechta red flag sizda bor? Izohda yozing 👇',
    collocation: 'Asosiy savolga pastdagi quizda javob bering 👇',
    band: '🔖 Saqlab qo‘ying va Speakingda ishlating!',
  };
  return [headers[post.kind], '', post.caption, '', calls[post.kind], '', ...FOOTER].join('\n');
}

/** POV goes out as text only, written like a short chat. */
export function buildPovText(post) {
  return [
    '💀 <b>POV: Speaking imtihonida…</b>',
    '',
    `🧑‍💼 <b>Examiner:</b> ${post.question}`,
    `🙂 <b>Siz:</b> ${post.bad}`,
    '',
    '😎 <b>Band 7 javob:</b>',
    `<i>${post.better}</i>`,
    '',
    ...post.vocab.map(([word, uz]) => `📚 <b>${word}</b> — ${uz}`),
    '',
    `💡 ${post.lesson}`,
    '',
    '🎙 Siz qanday javob berardingiz? Ovozli xabar bilan izohda qoldiring 👇',
    '',
    ...FOOTER,
  ].join('\n');
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
  if (post.kind === 'collocation') {
    return {
      question: 'Rasmdagi bo‘shliqqa qaysi fe\'l mos keladi?',
      options: ['make', 'do', 'take'],
      correct: post.answer,
      explanation: post.explanation,
    };
  }
  return null;
}

/** Rotate options so the right answer isn't always in the same place. */
function rotate(options, correct, by) {
  const n = options.length;
  const shift = by % n;
  return { options: options.map((_, i) => options[(i + shift) % n]), correct: (correct - shift + n) % n };
}

/** Sunday quiz series: one question from the latest post of each kind. */
export function buildWeeklyQuizzes(data, week = weekNumber()) {
  const latest = (kind) => {
    const index = (data.next_index[kind] || 0) - 1;
    return index >= 0 ? withDefaults(kind, data[kind][index]) : null;
  };
  const pairQuestion = (post, label) => {
    const row = week % post.rows.length;
    const others = post.rows.filter((_, i) => i !== row).slice(0, 3).map(([, better]) => better);
    const { options, correct } = rotate([post.rows[row][1], ...others], 0, week);
    return { question: label(post.rows[row][0]), options, correct, explanation: `${post.rows[row][0]} → ${post.rows[row][1]}` };
  };
  const quizzes = [];
  const upgrade = latest('upgrade');
  if (upgrade) quizzes.push(pairQuestion(upgrade, (plain) => `“${plain}” ning Band 9 varianti qaysi?`));
  const slang = latest('slang');
  if (slang) quizzes.push(pairQuestion(slang, (word) => `“${word}” ni IELTSda qanday aytamiz?`));
  const collocation = latest('collocation');
  if (collocation) quizzes.push({ ...buildQuiz(collocation), question: `Qaysi fe'l mos keladi? ${collocation.phrase}` });
  const emoji = latest('emoji');
  if (emoji) quizzes.push({ ...buildQuiz(emoji), question: `${emoji.emojis.join(' + ')} = ?` });
  const truefalse = latest('truefalse');
  if (truefalse) quizzes.push({ ...buildQuiz(truefalse), question: `Bu gap to‘g‘rimi? “${truefalse.sentence}”` });
  return quizzes.map((q, i) => ({ ...q, question: `${i + 1}/${quizzes.length}. ${q.question}` }));
}

function renderPosters(post) {
  const dir = mkdtempSync(join(tmpdir(), 'genz-'));
  const input = join(dir, 'post.json');
  const outputs = post.kind === 'band' ? [join(dir, 'slide1.png'), join(dir, 'slide2.png')] : [join(dir, 'poster.png')];
  writeFileSync(input, JSON.stringify(post));
  execFileSync('python3', [RENDER_SCRIPT, input, ...outputs], { stdio: 'pipe', timeout: 60_000 });
  return outputs;
}

/** Turn one bank entry into the list of Telegram messages to send, in order. */
export function buildMessages(kind, post, data) {
  if (kind === 'weekly') {
    const quizzes = buildWeeklyQuizzes(data);
    if (quizzes.length < 3) return [];
    return [
      {
        type: 'text',
        text: [
          '🏆 <b>HAFTA TESTI</b>',
          '',
          `So‘nggi postlardan ${quizzes.length} ta savol. Hammasiga javob bering va natijangizni izohda yozing 👇`,
          '',
          `🏅 ${quizzes.length}/${quizzes.length} to‘plaganlar izohda ✋ qoldirsin!`,
        ].join('\n'),
      },
      ...quizzes.map((quiz) => ({ type: 'quiz', ...quiz })),
    ];
  }
  if (kind === 'pov') return [{ type: 'text', text: buildPovText(post) }];
  if (kind === 'poll') return [{ type: 'poll', question: post.question, options: post.options }];

  const posters = renderPosters(post);
  const messages = [
    posters.length > 1
      ? { type: 'album', paths: posters, caption: buildCaption(post) }
      : { type: 'photo', path: posters[0], caption: buildCaption(post) },
  ];
  const quiz = buildQuiz(post);
  if (quiz) messages.push({ type: 'quiz', ...quiz });
  return messages;
}

async function send(message) {
  switch (message.type) {
    case 'photo':
      return sendLocalPhoto(message.path, message.caption);
    case 'album':
      return sendLocalAlbum(message.paths, message.caption);
    case 'text':
      return sendMessage(message.text, { disablePreview: true });
    case 'quiz':
      return sendQuiz(message.question, message.options, message.correct, message.explanation);
    case 'poll':
      return sendPoll(message.question, message.options);
    default:
      throw new Error(`Unknown message type ${message.type}`);
  }
}

async function main() {
  const kind = pickKind();
  const data = JSON.parse(readFileSync(POSTS_FILE, 'utf-8'));
  const index = data.next_index[kind] || 0;

  let post = null;
  if (kind !== 'weekly') {
    if (!data[kind]) throw new Error(`Unknown kind "${kind}"`);
    if (!data[kind][index]) {
      console.log(`ℹ️ No unused "${kind}" posts left. Add more to content/genz-posts.json.`);
      return;
    }
    post = withDefaults(kind, data[kind][index]);
  }
  console.log(`✨ ${kind} post #${index + 1}`);

  const messages = buildMessages(kind, post, data);
  if (!messages.length) {
    console.log('ℹ️ Not enough published posts yet to build the weekly quiz.');
    return;
  }

  if (isDryRun) {
    for (const message of messages) console.log(JSON.stringify(message, null, 1), '\n');
    console.log('✅ Dry run complete. Nothing published.');
    return;
  }

  validateConfig();
  for (const message of messages) {
    const result = await send(message);
    console.log(`✅ ${message.type} published!`, Array.isArray(result) ? '' : `Message ID: ${result.message_id}`);
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
