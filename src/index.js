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

import { sendMessage, sendQuiz, validateConfig } from './telegram.js';
import {
  getTimeSlot,
  getContentType,
  getContentFromDatabase,
  getDatabaseFile,
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

  // Handle quiz separately (uses sendPoll instead of sendMessage)
  if (contentType === 'quiz') {
    await handleQuiz();
    return;
  }

  // Try AI generation first, then fall back to database
  let postText = await tryAIGeneration(contentType);

  if (!postText) {
    console.log('📦 Using content from database...');
    const dbFile = getDatabaseFile(contentType);
    const item = getContentFromDatabase(dbFile);

    if (item) {
      postText = formatContent(contentType, item);
    }
  }

  if (!postText) {
    console.error('❌ Could not generate or find content. Skipping post.');
    process.exit(1);
  }

  // Ensure post doesn't exceed Telegram limit
  if (postText.length > 4096) {
    console.warn(`⚠️ Post too long (${postText.length} chars). Truncating...`);
    postText = postText.substring(0, 4090) + '\n...';
  }

  // Send or preview
  if (isDryRun || isTest) {
    console.log('\n📋 ═══ POST PREVIEW ═══\n');
    console.log(postText);
    console.log('\n═══════════════════════\n');
    console.log(`📏 Length: ${postText.length} / 4096 chars`);
    console.log('✅ Dry run complete. No message sent.');
  } else {
    console.log('📤 Sending to Telegram...');
    const result = await sendMessage(postText);
    console.log(`✅ Message sent! ID: ${result.message_id}`);
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

// Run
main().catch((error) => {
  console.error('💥 Fatal error:', error.message);
  process.exit(1);
});
