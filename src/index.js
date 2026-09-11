/**
 * IELTS Telegram Bot — Main Entry Point
 * 
 * Automatically posts IELTS preparation content to a Telegram channel.
 * 
 * Usage:
 *   node src/index.js              — Normal mode (sends to channel)
 *   node src/index.js --dry-run    — Preview mode (prints to console)
 *   node src/index.js --test       — Test mode (generates + prints, no send)
 * 
 * Environment Variables:
 *   TELEGRAM_BOT_TOKEN    — Bot token from @BotFather
 *   TELEGRAM_CHANNEL_ID   — Channel username (@channel) or ID (-100xxx)
 *   GEMINI_API_KEY         — Google Gemini API key
 *   TIME_SLOT              — Force time slot: morning, afternoon, evening
 *   CONTENT_TYPE           — Force content type (e.g., vocabulary, quiz)
 */

import { sendMessage, sendQuiz, sendDocument, validateConfig } from './telegram.js';
import { generateDailyReadingTest } from './reading-generator.js';
import {
  getTimeSlot,
  getContentType,
  getContentFromDatabase,
  getDatabaseFile,
  updateAndGetNextSpeakingPart
} from './content-selector.js';
import { formatContent } from './formatter.js';
import { getQuiz, validateQuiz, shuffleQuizOptions } from './quiz-generator.js';
import { generateDailySpeakingPublication } from './speaking-rotator.js';
import * as gemini from './gemini.js';

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isTest = args.includes('--test');

async function main() {
  console.log('🚀 IELTS Telegram Bot starting...');
  console.log(`📅 Time: ${new Date().toISOString()}`);

  // Validate config (skip for dry-run)
  if (!isDryRun && !isTest) {
    validateConfig();
  }

  // Determine what to post
  const timeSlot = getTimeSlot();
  const contentType = getContentType();

  console.log(`⏰ Time slot: ${timeSlot}`);
  console.log(`📋 Content type: ${contentType}`);

  // 🌙 Night Blackout Guard: Never post during night hours
  if (contentType === 'night-blackout') {
    console.log(`🌙 Night Blackout active (Tashkent time). No posts allowed between 21:00 and 08:00 to protect subscribers.`);
    process.exit(0);
  }

  if (contentType === 'quiz') {
    await handleQuiz();
    return;
  }
  
  if (contentType === 'grammar-quiz') {
    await handleGrammarQuiz();
    return;
  }
  
  if (contentType === 'speaking') {
    await handleSpeakingGuide();
    return;
  }
  
  if (contentType === 'micro-reading') {
    await handleMicroReading();
    return;
  }

  // Try AI generation first, then fall back to database
  let postText = null;
  let messageOptions = {};

  if (contentType === 'reading-test') {
    console.log('📱 Preparing Mini App reading test document...');
    const item = await generateDailyReadingTest();

    if (item) {
      postText = formatContent(contentType, item);
      const filePath = `public/${item.filename}`;
      messageOptions.document = {
        filePath: filePath,
        fileName: item.filename
      };
    }
  } else if (contentType === 'recent-speaking') {
    console.log('🗣 Generating Recent Speaking post...');
    const part = updateAndGetNextSpeakingPart();
    postText = await gemini.generateRecentSpeaking(part);
  } else {
    postText = await tryAIGeneration(contentType);

    if (!postText) {
      console.log('📦 Using content from database...');
      const dbFile = getDatabaseFile(contentType);
      const item = getContentFromDatabase(dbFile);

      if (item) {
        postText = formatContent(contentType, item);
      }
    }
  }

  if (!postText) {
    console.error(`❌ Could not generate content for '${contentType}'. Skipping post to avoid duplicate or incorrect fallback.`);
    process.exit(1);
  }

  // Strip stray markdown bolding (**bold**) to Telegram HTML
  postText = postText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  // Optional: strip stray markdown italic (*italic*) if it's not a bullet point
  postText = postText.replace(/(^|[^\\])\*([^*\n]+)\*/g, '$1<i>$2</i>');

  // Convert unsupported HTML tags to valid Telegram equivalents
  postText = postText.replace(/<br\s*\/?>/gi, '\n');
  postText = postText.replace(/<li>/gi, '• ');
  postText = postText.replace(/<\/?(ul|ol|li)[^>]*>/gi, '');
  postText = postText.replace(/<\/p>/gi, '\n\n');
  postText = postText.replace(/<p[^>]*>/gi, '');

  // Smart escape of < and & to prevent Telegram parse errors without breaking valid tags
  postText = postText.replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;');
  postText = postText.replace(/<(?!b>|\/b>|i>|\/i>|u>|\/u>|s>|\/s>|a |\/a>|code>|\/code>|pre>|\/pre>)/g, '&lt;');


  // Ensure post doesn't exceed Telegram limit
  if (postText.length > 4096) {
    console.warn(`⚠️ Post too long (${postText.length} chars). Truncating...`);
    postText = postText.substring(0, 4090) + '\n...';
  }

  // Send or preview
  if (isDryRun || isTest) {
    console.log('\n📋 ═══ POST PREVIEW ═══\n');
    console.log(postText);
    if (messageOptions.document) {
      console.log('\n📎 Attached Document: ', messageOptions.document.fileName);
    }
    console.log('\n═══════════════════════\n');
    console.log(`📏 Length: ${postText.length} / 4096 chars`);
    console.log('✅ Dry run complete. No message sent.');
  } else {
    console.log('📤 Sending to Telegram...');
    let result;
    try {
      if (messageOptions.document) {
        result = await sendDocument(
          messageOptions.document.filePath,
          messageOptions.document.fileName,
          postText
        );
      } else {
        result = await sendMessage(postText, messageOptions);
      }
      console.log(`✅ Message/Document sent! ID: ${result.message_id}`);
    } catch (sendError) {
      console.error('❌ Failed to send content to Telegram:', sendError.message);
      
      if (sendError.message.includes("can't parse entities")) {
        console.log('📦 Format error detected. Falling back to sending AI content as plain text...');
        try {
          const plainOptions = { ...messageOptions, extra: { ...(messageOptions.extra || {}), parse_mode: '' } };
          if (messageOptions.document) {
             result = await sendDocument(
               messageOptions.document.filePath,
               messageOptions.document.fileName,
               postText.replace(/<[^>]+>/gm, '') // Strip valid HTML tags, leave unclosed ones alone to prevent truncation
             );
          } else {
             result = await sendMessage(postText.replace(/<[^>]+>/gm, ''), plainOptions);
          }
          console.log(`✅ Plain text fallback sent! ID: ${result.message_id}`);
          return;
        } catch (plainError) {
          console.error('❌ Plain text fallback also failed:', plainError.message);
          process.exit(1);
        }
      }
      
      process.exit(1);
    }
  }
}

/**
 * Try to generate content using Gemini AI
 */
async function tryAIGeneration(contentType) {
  const generators = {
    vocabulary: gemini.generateVocabulary,
    writing: gemini.generateWritingTip,
    speaking: gemini.generateSpeakingTip,
    'reading-listening': gemini.generateReadingListeningStrategy,
    'band-score': gemini.generateBandScoreTip,
    motivation: gemini.generateMotivation,
    'magic-3': gemini.generateMagic3,
    idiom: gemini.generateIdiom,
    collocation: gemini.generateCollocation,
  };

  const generator = generators[contentType];
  if (!generator) return null;

  console.log('🤖 Trying AI content generation...');
  const result = await generator();

  if (result) {
    console.log('✅ AI content generated successfully');
    return result;
  }

  console.log('⚠️ AI generation failed, falling back to database');
  return null;
}

/**
 * Handle quiz posting (uses sendPoll API)
 */
async function handleQuiz() {
  const quiz = await getQuiz();
  const validation = validateQuiz(quiz);

  if (!validation.valid) {
    console.error(`❌ Quiz validation failed: ${validation.reason}`);
    process.exit(1);
  }

  if (isDryRun || isTest) {
    console.log('\n❓ ═══ QUIZ PREVIEW ═══\n');
    console.log(`Question: ${quiz.question}`);
    console.log(`Options:`);
    quiz.options.forEach((opt, i) => {
      const marker = i === quiz.correctIndex ? '✅' : '  ';
      console.log(`  ${marker} ${i + 1}. ${opt}`);
    });
    console.log(`\nExplanation: ${quiz.explanation}`);
    console.log('\n═══════════════════════\n');
    console.log('✅ Dry run complete. No quiz sent.');
  } else {
    console.log('📤 Sending quiz to Telegram...');
    const result = await sendQuiz(
      quiz.question,
      quiz.options,
      quiz.correctIndex,
      quiz.explanation
    );
    console.log(`✅ Quiz sent! ID: ${result.message_id}`);
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Handle grammar error quiz posting (Generates 2 quizzes: 1 Easy + 1 Hard)
 */
async function handleGrammarQuiz() {
  console.log('🤖 Generating Grammar Quiz Pair (1 Easy + 1 Hard)...');

  const quizzes = [];

  // 1. Easy / Intermediate Quiz
  console.log('🔹 Generating Quiz 1: Osonroq / Intermediate...');
  const easyData = await gemini.generateGrammarQuiz('easy');
  if (easyData) {
    const easyQuiz = {
      question: "🟢 GRAMMAR FIX (1-savol: Osonroq):\n" + easyData.question,
      options: easyData.options,
      correctIndex: easyData.correct_index,
      explanation: easyData.explanation_uz,
      level: 'Osonroq (Intermediate)'
    };
    shuffleQuizOptions(easyQuiz);
    if (validateQuiz(easyQuiz).valid) {
      quizzes.push(easyQuiz);
    }
  }

  // 2. Hard / Advanced Quiz
  console.log('🔸 Generating Quiz 2: Qiyinroq / Advanced...');
  const hardData = await gemini.generateGrammarQuiz('hard');
  if (hardData) {
    const hardQuiz = {
      question: "🔴 GRAMMAR FIX (2-savol: Qiyinroq):\n" + hardData.question,
      options: hardData.options,
      correctIndex: hardData.correct_index,
      explanation: hardData.explanation_uz,
      level: 'Qiyinroq (Advanced)'
    };
    shuffleQuizOptions(hardQuiz);
    if (validateQuiz(hardQuiz).valid) {
      quizzes.push(hardQuiz);
    }
  }

  // Fallback if needed
  if (quizzes.length === 0) {
    console.log('⚠️ AI generation failed for grammar quizzes. Falling back to quizzes database...');
    const dbQuiz = await getQuiz();
    if (dbQuiz) {
      const fallbackQuiz = {
        question: "🛠 GRAMMAR FIX:\n" + dbQuiz.question,
        options: dbQuiz.options,
        correctIndex: dbQuiz.correctIndex,
        explanation: dbQuiz.explanation,
        level: 'Standard'
      };
      shuffleQuizOptions(fallbackQuiz);
      quizzes.push(fallbackQuiz);
    }
  }

  if (quizzes.length === 0) {
    console.error('❌ Could not generate any grammar quizzes.');
    process.exit(1);
  }

  if (isDryRun || isTest) {
    console.log(`\n❓ ═══ GRAMMAR QUIZ PAIR PREVIEW (${quizzes.length} quizzes) ═══\n`);
    for (const [idx, q] of quizzes.entries()) {
      console.log(`--- Quiz #${idx + 1} [${q.level}] ---`);
      console.log(`Question: ${q.question}`);
      console.log(`Options:`);
      q.options.forEach((opt, i) => {
        const marker = i === q.correctIndex ? '✅' : '  ';
        console.log(`  ${marker} ${i + 1}. ${opt}`);
      });
      console.log(`\nExplanation: ${q.explanation}\n`);
    }
    console.log('════════════════════════════════════════════\n');
    console.log('✅ Dry run complete. No grammar quizzes sent.');
  } else {
    console.log(`📤 Sending ${quizzes.length} grammar quiz(zes) to Telegram...`);
    for (let i = 0; i < quizzes.length; i++) {
      const q = quizzes[i];
      const result = await sendQuiz(
        q.question,
        q.options,
        q.correctIndex,
        q.explanation
      );
      console.log(`✅ Grammar Quiz #${i + 1} [${q.level}] sent! ID: ${result.message_id}`);
      if (i < quizzes.length - 1) {
        console.log('⏳ Waiting 2.5s before sending second quiz...');
        await sleep(2500);
      }
    }
  }
}

/**
 * Handle Speaking Masterclass PDF Guide posting
 */
async function handleSpeakingGuide() {
  console.log('🎙 Preparing Daily Speaking Masterclass Guide...');
  const pub = await generateDailySpeakingPublication();
  
  if (!pub || !pub.pdfPath) {
    console.error('❌ Failed to generate speaking publication');
    process.exit(1);
  }

  if (isDryRun || isTest) {
    console.log('\n📄 ═══ SPEAKING PDF PREVIEW ═══\n');
    console.log(`Part: ${pub.partNumber}`);
    console.log(`File: ${pub.fileName}`);
    console.log(`PDF Path: ${pub.pdfPath}`);
    console.log(`Caption:\n${pub.caption}`);
    console.log('\n═══════════════════════════════\n');
    console.log('✅ Dry run complete. No document sent.');
  } else {
    console.log('📤 Sending Speaking PDF Guide to Telegram...');
    const result = await sendDocument(pub.pdfPath, pub.fileName, pub.caption);
    console.log(`✅ Speaking PDF Guide sent! ID: ${result.message_id}`);
  }
}

/**
 * Handle Micro Reading posting (Text + Quiz)
 */
async function handleMicroReading() {
  console.log('🤖 Generating Micro Reading...');
  const data = await gemini.generateMicroReading();
  
  if (!data) {
    console.error('❌ Could not generate Micro Reading. Skipping post.');
    process.exit(1);
  }

  if (isDryRun || isTest) {
    console.log('\\n📖 ═══ MICRO READING PREVIEW ═══\\n');
    console.log(data.text);
    console.log('\\n❓ ═══ QUIZ PREVIEW ═══\\n');
    data.quizzes.forEach((quiz, qIndex) => {
      console.log(`[Quiz ${qIndex + 1}] Question: ${quiz.question}`);
      console.log(`Options:`);
      quiz.options.forEach((opt, i) => {
        const marker = i === quiz.correct_index ? '✅' : '  ';
        console.log(`  ${marker} ${i + 1}. ${opt}`);
      });
      console.log(`Explanation: ${quiz.explanation}\\n`);
    });
    console.log('\\n═══════════════════════\\n');
  } else {
    console.log('📤 Sending Micro Reading text to Telegram...');
    try {
      const textResult = await sendMessage(data.text, {});
      console.log(`✅ Text sent! ID: ${textResult.message_id}`);
      
      console.log('📤 Sending Quizzes attached to the text...');
      for (let i = 0; i < data.quizzes.length; i++) {
        let quiz = data.quizzes[i];
        
        // Map correct_index to correctIndex for validateQuiz
        const mappedQuiz = {
          question: quiz.question,
          options: quiz.options,
          correctIndex: quiz.correct_index,
          explanation: quiz.explanation || ''
        };
        
        const validation = validateQuiz(mappedQuiz);
        if (!validation.valid) {
          console.error(`⚠️ Quiz ${i + 1} is invalid: ${validation.reason}. Skipping...`);
          continue;
        }

        const quizResult = await sendQuiz(
          mappedQuiz.question,
          mappedQuiz.options,
          mappedQuiz.correctIndex,
          mappedQuiz.explanation
        );
        console.log(`✅ Quiz ${i + 1} sent! ID: ${quizResult.message_id}`);
      }
    } catch (error) {
      console.error('❌ Failed to send Micro Reading:', error.message);
      process.exit(1);
    }
  }
}

// Run
main().catch((error) => {
  console.error('💥 Fatal error:', error.message);
  process.exit(1);
});
