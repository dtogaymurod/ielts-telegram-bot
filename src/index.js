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
 *   TELEGRAM_ADMIN_ID     — Turns on review: only the post the admin approved
 *                           the evening before is published (see src/review.js)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { sendMessage, sendLocalPhoto, validateConfig } from './telegram.js';
import { renderPoster, renderLoneWolfPoster, captionLength, CAPTION_LIMIT } from './poster.js';
import {
  getTimeSlot, getNextSkill, getRotationState, getSkillHackFallback, isLoneWolfDay, getNextLoneWolfPost,
  peekLoneWolfPost, markLoneWolfPublished,
} from './content-selector.js';
import { generateDailySkillPost } from './gemini.js';
import { approvedDraft, dateAt, markPublished, openReview, reviewEnabled } from './review.js';

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isTest = args.includes('--test');
const SLOT = '19:30';

/**
 * Send a Lone Wolf task: poster (steps) + caption (the rest) when the task
 * has a "poster" block, otherwise the old text post.
 */
async function sendLoneWolf(post) {
  if (post.poster && post.caption) {
    const posterPath = renderLoneWolfPoster(post);
    if (posterPath) {
      try {
        const result = await sendLocalPhoto(posterPath, post.caption);
        console.log(`✅ Lone Wolf poster sent! Message ID: ${result.message_id}`);
        return;
      } catch (error) {
        console.error('⚠️ Lone Wolf poster send failed, falling back to text post:', error.message);
      }
    }
  }
  const result = await sendMessage(post.post_text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>'), { disablePreview: true });
  console.log(`✅ Lone Wolf text sent! Message ID: ${result.message_id}`);
}

/** Write the day's skill post with Gemini (pre-screened fallback if AI fails), as safe Telegram HTML. */
async function writeSkillPost(skill) {
  console.log(`🤖 Generating compact single-screen post for ${skill}...`);
  let postText = await generateDailySkillPost(skill);

  if (!postText) {
    console.log('⚠️ AI generation failed or offline. Using pre-screened fallback from database...');
    postText = getSkillHackFallback(skill);
  }
  if (!postText) return null;

  // Safety sanitization of markdown bold/italic residues to valid Telegram HTML
  postText = postText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  postText = postText.replace(/<br\s*\/?>/gi, '\n');
  postText = postText.replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;');
  postText = postText.replace(/<(?!b>|\/b>|i>|\/i>|u>|\/u>|a |\/a>)/g, '&lt;');
  return postText;
}

/** Branded poster image with the post as its caption (text-only if rendering fails). */
async function sendSkillPost(postText) {
  const posterPath = renderPoster(postText);
  if (posterPath) {
    console.log('🖼 Sending poster...');
    try {
      if (captionLength(postText) <= CAPTION_LIMIT) {
        const result = await sendLocalPhoto(posterPath, postText);
        console.log(`✅ Poster sent with caption! Message ID: ${result.message_id}`);
        return;
      }
      // Too long for a photo caption: poster first, full text right after
      await sendLocalPhoto(posterPath, '');
      console.log('ℹ️ Post is longer than a caption allows, sending the text separately.');
    } catch (error) {
      console.error('⚠️ Poster send failed, falling back to text post:', error.message);
    }
  }

  console.log('📤 Sending post text...');
  try {
    const result = await sendMessage(postText, {});
    console.log(`✅ Text sent! Message ID: ${result.message_id}`);
  } catch (error) {
    if (!error.message.includes("can't parse entities")) throw error;
    console.log('⚠️ Entity parsing issue detected. Retrying without HTML parse mode...');
    const plainResult = await sendMessage(postText.replace(/<[^>]+>/g, ''), { extra: { parse_mode: '' } });
    console.log(`✅ Sent as plain text. Message ID: ${plainResult.message_id}`);
  }
}

/**
 * Evening preview for review: tomorrow's 19:30 post (date is YYYY-MM-DD).
 * The Gemini text is written now, so the admin approves the exact text that
 * goes out; the skill rotation only moves on when it is published.
 */
export async function prepareDailyDraft(date) {
  if (isLoneWolfDay(dateAt(date))) {
    const post = peekLoneWolfPost();
    if (!post) throw new Error('Yolg‘iz bo‘ri topshiriqlari tugadi, content/lone_wolf_queue.json ga yangilarini qo‘shish kerak');
    return {
      slot: SLOT,
      label: `Yolg‘iz bo‘ri #${post.index}`,
      meta: { type: 'lonewolf', index: post.index },
      send: () => sendLoneWolf(post),
    };
  }
  const skill = getRotationState().nextSkill || 'listening';
  const text = await writeSkillPost(skill);
  if (!text) throw new Error(`${skill} posti uchun matn yozib bo‘lmadi`);
  return {
    slot: SLOT,
    label: `Kundalik post (${skill.toUpperCase()})`,
    meta: { type: 'skill', skill, text },
    send: () => sendSkillPost(text),
  };
}

/** Review on: publish the draft the admin approved last night. */
async function publishApproved() {
  const review = await openReview();
  const draft = await approvedDraft(review, SLOT);
  if (!draft) return;

  if (draft.meta.type === 'lonewolf') {
    const queue = JSON.parse(readFileSync(new URL('../content/lone_wolf_queue.json', import.meta.url), 'utf-8'));
    const post = queue.posts.find((p) => p.index === draft.meta.index);
    console.log(`🐺 Publishing approved Lone Wolf task #${post.index}: ${post.title}`);
    await sendLoneWolf(post);
    markLoneWolfPublished(post.index);
  } else {
    console.log(`🎯 Publishing approved ${draft.meta.skill} post`);
    await sendSkillPost(draft.meta.text);
    getNextSkill(); // advance the rotation now that the post is out
  }
  await markPublished(review, SLOT);
}

async function main() {
  console.log('🚀 IELTS Telegram Bot starting (Daily 1-Post System)...');
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`⏰ Tashkent Time: ${getTimeSlot()}`);

  const preview = isDryRun || isTest;
  const forcedSkill = process.env.SKILL || process.env.CONTENT_TYPE;

  // Validate bot config (skip for preview/test)
  if (!preview) {
    validateConfig();
    if (reviewEnabled() && !forcedSkill) return publishApproved();
  }

  // Check if today is a Lone Wolf scheduled day (Tuesday, Thursday, Saturday)
  if (!forcedSkill && isLoneWolfDay()) {
    const loneWolf = getNextLoneWolfPost();
    if (loneWolf?.alreadyPublishedToday) {
      console.log("ℹ️ Today's Lone Wolf task has already been published. Skipping to maintain strictly 1 post per day.");
      return;
    }
    if (loneWolf?.post) {
      console.log(`🐺 Today is Lone Wolf day (Tue/Thu/Sat)! Publishing task #${loneWolf.post.index}: ${loneWolf.post.title}...`);
      if (preview) {
        const posterPath = loneWolf.post.poster && loneWolf.post.caption ? renderLoneWolfPoster(loneWolf.post) : null;
        console.log(posterPath ? `\n🐺 Poster preview saved: ${posterPath}\n\n${loneWolf.post.caption}\n` : `\n${loneWolf.post.post_text}\n`);
        console.log('✅ Dry run complete. No message sent.');
        return;
      }
      await sendLoneWolf(loneWolf.post);
      loneWolf.advance();
      return;
    }
  }

  // Determine which skill to post today (Listening ➡️ Reading ➡️ Writing ➡️ Speaking)
  const skill = getNextSkill();
  console.log(`🎯 Today's Selected Skill: [${skill.toUpperCase()}]`);

  const postText = await writeSkillPost(skill);
  if (!postText) {
    console.error(`❌ Could not generate or retrieve content for '${skill}'.`);
    process.exit(1);
  }

  const charCount = postText.length;
  const wordCount = postText.trim().split(/\s+/).length;
  console.log(`📏 Length: ${charCount} chars | ~${wordCount} words`);

  if (preview) {
    console.log('\n📱 ═══ SINGLE-SCREEN POST PREVIEW ═══\n');
    console.log(postText);
    console.log('\n═════════════════════════════════════\n');
    console.log(`• Scroll-free on mobile: ${charCount <= 850 ? 'YES ✅' : 'NO ⚠️'}`);
    const previewPoster = renderPoster(postText);
    if (previewPoster) console.log(`🖼 Poster preview saved: ${previewPoster}`);
    console.log('✅ Dry run complete. No message sent.');
    return;
  }

  await sendSkillPost(postText);
}

// Run when executed directly (src/review.js imports prepareDailyDraft)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}
