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
  updateAndGetNextSpeakingPart,
  updateAndGetNextWritingTask
} from './content-selector.js';
import { formatContent } from './formatter.js';
import { getQuiz, validateQuiz } from './quiz-generator.js';
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

  if (contentType === 'quiz') {
    await handleQuiz();
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
  } else if (contentType === 'recent-writing') {
    console.log('✍️ Generating Recent Writing post...');
    const task = updateAndGetNextWritingTask();
    postText = await gemini.generateRecentWriting(task);
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
    console.log('⚠️ AI generation failed for recent exams. Falling back to database (motivation)...');
    const dbFile = getDatabaseFile('motivation');
    const item = getContentFromDatabase(dbFile);
    if (item) {
      postText = formatContent('motivation', item);
    }
  }

  if (!postText) {
    console.error('❌ Could not generate or find content. Skipping post.');
    process.exit(1);
  }

  // Strip stray markdown bolding (**bold**) to Telegram HTML
  postText = postText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  // Optional: strip stray markdown italic (*italic*) if it's not a bullet point
  postText = postText.replace(/(^|[^\\])\*([^*\n]+)\*/g, '$1<i>$2</i>');

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
               postText.replace(/<[^>]*>?/gm, '') // Strip HTML for caption just in case
             );
          } else {
             result = await sendMessage(postText.replace(/<[^>]*>?/gm, ''), plainOptions);
          }
          console.log(`✅ Plain text fallback sent! ID: ${result.message_id}`);
          return;
        } catch (plainError) {
          console.error('❌ Plain text fallback also failed:', plainError.message);
        }
      }
      
      console.log('📦 Final fallback: Sending motivation from database...');
      try {
        const dbFile = getDatabaseFile('motivation');
        const item = getContentFromDatabase(dbFile);
        if (item) {
          const fallbackText = formatContent('motivation', item);
          result = await sendMessage(fallbackText, {});
          console.log(`✅ Database fallback message sent! ID: ${result.message_id}`);
        } else {
          console.error('❌ No motivation items found for fallback.');
          process.exit(1);
        }
      } catch (finalError) {
        console.error('💥 Database fallback message failed:', finalError.message);
        process.exit(1);
      }
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

/**
 * Handle Micro Reading posting (Text + Quiz)
 */
async function handleMicroReading() {
  console.log('🤖 Generating Micro Reading...');
  const data = await gemini.generateMicroReading();
  
  if (!data) {
    console.log('⚠️ AI generation failed for Micro Reading. Falling back to database (motivation)...');
    const dbFile = getDatabaseFile('motivation');
    const item = getContentFromDatabase(dbFile);
    if (item) {
      const fallbackText = formatContent('motivation', item);
      if (!isDryRun && !isTest) {
         await sendMessage(fallbackText, {});
      } else {
         console.log('Dry Run Fallback:', fallbackText);
      }
    }
    return;
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
        const quiz = data.quizzes[i];
        const quizResult = await sendQuiz(
          quiz.question,
          quiz.options,
          quiz.correct_index,
          quiz.explanation
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
