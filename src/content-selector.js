/**
 * Content Selector
 * Determines which content type to post based on the time slot
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', 'content');

/**
 * Get the current time slot based on Tashkent time for logging
 * @returns {string} Time string
 */
export function getTimeSlot() {
  const now = new Date();
  const tashkentHour = (now.getUTCHours() + 5) % 24;
  return `${String(tashkentHour).padStart(2, '0')}:00`;
}

/**
 * Get the content type for the current time slot
 * @returns {string} Content type identifier
 */
export function getContentType() {
  // Check if forced content type is set (for testing or workflow dispatch)
  const forcedType = process.env.CONTENT_TYPE || process.env.TIME_SLOT;
  if (forcedType && forcedType !== 'night-blackout') return forcedType;

  // Auto-detect based on Tashkent time (UTC+5)
  const now = new Date();
  const tashkentHour = (now.getUTCHours() + 5) % 24;

  // 🌙 Night Blackout Guard: 22:00 to 08:00 Tashkent time
  if (tashkentHour >= 22 || tashkentHour < 8) {
    return 'night-blackout';
  }

  // 🎯 Prime Times (Tashkent Time UTC+5)
  if (tashkentHour >= 8 && tashkentHour < 11) return 'recent-speaking';
  if (tashkentHour >= 11 && tashkentHour < 13) return 'collocation';
  if (tashkentHour >= 13 && tashkentHour < 16) return 'speaking';
  if (tashkentHour >= 16 && tashkentHour < 18) return 'reading-listening';
  if (tashkentHour >= 18 && tashkentHour < 21) return 'grammar-quiz';
  if (tashkentHour >= 21 && tashkentHour < 22) return 'podcast';

  return 'night-blackout';
}


/**
 * Get and update the next speaking part
 * @returns {number} 1, 2, or 3
 */
export function updateAndGetNextSpeakingPart() {
  const statePath = join(CONTENT_DIR, 'state.json');
  try {
    const state = JSON.parse(readFileSync(statePath, 'utf-8'));
    let part = state.lastSpeakingPart + 1;
    if (part > 3) part = 1;
    state.lastSpeakingPart = part;
    writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
    return part;
  } catch (err) {
    console.error('Error reading state.json:', err.message);
    return 1;
  }
}



/**
 * Get a random unused item from a content file
 * @param {string} contentType - Content type (matches JSON filename)
 * @returns {object|null} Content item or null if all used/file missing
 */
export function getContentFromDatabase(contentType) {
  const filePath = join(CONTENT_DIR, `${contentType}.json`);

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const items = JSON.parse(raw);

    // Filter unused items
    const unused = items.filter((item) => !item.used);

    if (unused.length === 0) {
      console.log(`❌ All ${contentType} items have been used. Strict 'no repeat' rule prevents resetting.`);
      return null;
    }

    // Pick a random unused item
    const selected = unused[Math.floor(Math.random() * unused.length)];

    // Mark as used
    const itemIndex = items.findIndex((item) => item.id === selected.id);
    if (itemIndex !== -1) {
      items[itemIndex].used = true;
      writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf-8');
    }

    return selected;
  } catch (error) {
    console.error(`⚠️ Could not read ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Map content types to their database file names
 */
export const CONTENT_TYPE_MAP = {
  vocabulary: 'vocabulary',
  writing: 'writing-tips',
  speaking: 'speaking-tips',
  'reading-listening': 'reading-listening',
  'band-score': 'band-score-tips',
  motivation: 'motivation',
  quiz: 'quizzes',
  'reading-test': 'reading-tests',
};

/**
 * Get the database filename for a content type
 */
export function getDatabaseFile(contentType) {
  return CONTENT_TYPE_MAP[contentType] || contentType;
}
