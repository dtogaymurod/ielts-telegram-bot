/**
 * Content Selector
 * Determines which IELTS skill to post based on daily 4-skill rotation:
 * Listening ➡️ Reading ➡️ Writing ➡️ Speaking ➡️ Listening...
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', 'content');
const ROTATION_FILE = join(CONTENT_DIR, 'skill_rotation.json');
const HACKS_FILE = join(CONTENT_DIR, 'skill-hacks.json');
const LONE_WOLF_FILE = join(CONTENT_DIR, 'lone_wolf_queue.json');

const SKILL_ORDER = ['listening', 'reading', 'writing', 'speaking'];

/**
 * Get current time string (Tashkent UTC+5) for logging
 * @returns {string} Time string
 */
export function getTimeSlot() {
  const now = new Date();
  const tashkentHour = (now.getUTCHours() + 5) % 24;
  const tashkentMin = now.getUTCMinutes();
  return `${String(tashkentHour).padStart(2, '0')}:${String(tashkentMin).padStart(2, '0')}`;
}

/**
 * Get the current rotation state
 * @returns {{ nextSkill: string, lastUpdated?: string }}
 */
export function getRotationState() {
  try {
    if (existsSync(ROTATION_FILE)) {
      const data = JSON.parse(readFileSync(ROTATION_FILE, 'utf-8'));
      if (SKILL_ORDER.includes(data.nextSkill)) {
        return data;
      }
    }
  } catch (_) {}
  return { nextSkill: 'listening' };
}

/**
 * Save updated rotation state
 * @param {{ nextSkill: string, lastUpdated?: string }} state
 */
export function saveRotationState(state) {
  try {
    writeFileSync(ROTATION_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('⚠️ Could not save skill_rotation.json:', err.message);
  }
}

/**
 * Determine which skill to post today, and advance rotation for tomorrow
 * @returns {string} One of: 'listening', 'reading', 'writing', 'speaking'
 */
export function getNextSkill() {
  // Allow manual override via environment variable
  const forcedSkill = process.env.SKILL || process.env.CONTENT_TYPE;
  if (forcedSkill && SKILL_ORDER.includes(forcedSkill.toLowerCase())) {
    return forcedSkill.toLowerCase();
  }

  const state = getRotationState();
  const currentSkill = state.nextSkill || 'listening';

  // Determine the next skill for tomorrow
  const currentIndex = SKILL_ORDER.indexOf(currentSkill);
  const nextIndex = (currentIndex + 1) % SKILL_ORDER.length;
  const tomorrowSkill = SKILL_ORDER[nextIndex];

  // Save new state
  saveRotationState({
    nextSkill: tomorrowSkill,
    lastUpdated: new Date().toISOString(),
  });

  return currentSkill;
}

/**
 * Retrieve a fallback hack from database if AI is offline
 * @param {string} skill - 'listening' | 'reading' | 'writing' | 'speaking'
 * @returns {string|null} Pre-screened post text
 */
export function getSkillHackFallback(skill) {
  try {
    if (existsSync(HACKS_FILE)) {
      const hacks = JSON.parse(readFileSync(HACKS_FILE, 'utf-8'));
      const list = hacks[skill];
      if (Array.isArray(list) && list.length > 0) {
        const unused = list.filter(item => !item.used);
        const candidates = unused.length > 0 ? unused : list;
        if (unused.length === 0) {
          list.forEach(item => item.used = false);
        }
        const selected = candidates[Math.floor(Math.random() * candidates.length)];
        selected.used = true;
        writeFileSync(HACKS_FILE, JSON.stringify(hacks, null, 2), 'utf-8');
        return selected.text || null;
      }
    }
  } catch (err) {
    console.error('⚠️ Error reading skill-hacks.json:', err.message);
  }
  return null;
}

/**
 * Check if today is a Lone Wolf scheduled day (Tuesday, Thursday, Saturday) in Tashkent time (UTC+5)
 * @returns {boolean}
 */
export function isLoneWolfDay() {
  const now = new Date();
  const tashkentTime = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const day = tashkentTime.getUTCDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
  return day === 2 || day === 4 || day === 6; // Tuesday, Thursday, Saturday
}

/**
 * Get current date string in Tashkent timezone (YYYY-MM-DD)
 * @returns {string}
 */
export function getTashkentDateString() {
  const now = new Date();
  const tashkentTime = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return tashkentTime.toISOString().split('T')[0];
}

/**
 * Retrieve the next Lone Wolf task from queue if available and not yet posted today
 */
export function getNextLoneWolfPost() {
  try {
    if (!existsSync(LONE_WOLF_FILE)) return null;
    const data = JSON.parse(readFileSync(LONE_WOLF_FILE, 'utf-8'));
    const todayStr = getTashkentDateString();

    // Check if already posted today
    if (data.last_published_date === todayStr) {
      return { alreadyPublishedToday: true };
    }

    const idx = data.last_published_index || 0;
    if (idx < data.posts.length) {
      const post = data.posts[idx];
      return {
        alreadyPublishedToday: false,
        post,
        advance: () => {
          data.last_published_index = idx + 1;
          data.last_published_date = todayStr;
          writeFileSync(LONE_WOLF_FILE, JSON.stringify(data, null, 2), 'utf-8');
        }
      };
    }
  } catch (err) {
    console.error('⚠️ Error reading lone_wolf_queue.json:', err.message);
  }
  return null;
}

