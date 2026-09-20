/**
 * IELTS Telegram Bot — Main Entry Point (1 Post Per Day System)
 * 
 * Automatically posts concise, high-value IELTS preparation content to Telegram.
 * Rotates daily through 4 skills: Listening ➡️ Reading ➡️ Writing ➡️ Speaking.
 * Enforces single-screen length (no scroll) and 100% completion validation.
 * 
 * Usage:
 *   node src/index.js              — Normal mode (sends to channel)
 *   node src/index.js --dry-run    — Preview mode (prints to console)
 *   node src/index.js --test       — Test mode (generates + prints, no send)
 * 
 * Environment Variables:
 *   TELEGRAM_BOT_TOKEN    — Bot token from @BotFather
 *   TELEGRAM_CHANNEL_ID   — Channel username (@channel) or ID (-100xxx)
 *   GEMINI_API_KEY        — Google Gemini API key
 *   SKILL                 — Force specific skill ('listening', 'reading', 'writing', 'speaking')
 */

import { sendMessage, validateConfig } from './telegram.js';
import { getTimeSlot, getNextSkill, getSkillHackFallback } from './content-selector.js';
import { generateDailySkillPost, validatePostCompleteness } from './gemini.js';

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isTest = args.includes('--test');

async function main() {
  console.log('🚀 IELTS Telegram Bot starting (Daily 1-Post System)...');
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`⏰ Tashkent Time: ${getTimeSlot()}`);

  // Validate bot config (skip for preview/test)
  if (!isDryRun && !isTest) {
    validateConfig();
  }

  // Determine which skill to post today (Listening ➡️ Reading ➡️ Writing ➡️ Speaking)
  const skill = getNextSkill();
  console.log(`🎯 Today's Selected Skill: [${skill.toUpperCase()}]`);

  // 1. Try Gemini AI generation with completeness validation
  console.log(`🤖 Generating compact single-screen post for ${skill}...`);
  let postText = await generateDailySkillPost(skill);

  // 2. Fallback to pre-screened database hack if AI fails or network unavailable
  if (!postText) {
    console.log('⚠️ AI generation failed or offline. Using pre-screened fallback from database...');
    postText = getSkillHackFallback(skill);
  }

  if (!postText) {
    console.error(`❌ Could not generate or retrieve content for '${skill}'.`);
    process.exit(1);
  }

  // Safety sanitization of markdown bold/italic residues to valid Telegram HTML
  postText = postText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  postText = postText.replace(/<br\s*\/?>/gi, '\n');
  postText = postText.replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;');
  postText = postText.replace(/<(?!b>|\/b>|i>|\/i>|u>|\/u>|a |\/a>)/g, '&lt;');

  // Final length & layout check
  const charCount = postText.length;
  const wordCount = postText.trim().split(/\s+/).length;

  console.log(`📏 Length: ${charCount} chars | ~${wordCount} words`);

  // Send or preview
  if (isDryRun || isTest) {
    console.log('\n📱 ═══ SINGLE-SCREEN POST PREVIEW ═══\n');
    console.log(postText);
    console.log('\n═════════════════════════════════════\n');
    console.log(`✅ Single-Screen Verification:`);
    console.log(`• Characters: ${charCount} (Ideal: 450-750)`);
    console.log(`• Words: ${wordCount} (Ideal: 65-90)`);
    console.log(`• Scroll-free on mobile: ${charCount <= 850 ? 'YES ✅' : 'NO ⚠️'}`);
    console.log('✅ Dry run complete. No message sent.');
    return;
  }

  console.log('📤 Sending post to Telegram channel...');
  try {
    const result = await sendMessage(postText, {});
    console.log(`✅ Successfully published to Telegram channel! Message ID: ${result.message_id}`);
  } catch (error) {
    console.error('❌ Failed to send message to Telegram:', error.message);
    if (error.message.includes("can't parse entities")) {
      console.log('⚠️ Entity parsing issue detected. Retrying without HTML parse mode...');
      try {
        const plainResult = await sendMessage(postText.replace(/<[^>]+>/g, ''), { extra: { parse_mode: '' } });
        console.log(`✅ Sent as plain text. Message ID: ${plainResult.message_id}`);
        return;
      } catch (plainError) {
        console.error('❌ Plain text fallback failed:', plainError.message);
      }
    }
    process.exit(1);
  }
}

// Run
main().catch((error) => {
  console.error('💥 Fatal error:', error.message);
  process.exit(1);
});
