/**
 * Content Selector
 * Determines which content type to post based on the day and time slot
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', 'content');

// Weekly schedule: maps [dayOfWeek][timeSlot] to content type
// dayOfWeek: 0=Sunday, 1=Monday, ..., 6=Saturday
const SCHEDULE = {
  0: { morning: 'vocabulary', afternoon: 'speaking', evening: 'motivation' },
  1: { morning: 'vocabulary', afternoon: 'speaking', evening: 'quiz' },
  2: { morning: 'writing', afternoon: 'reading-listening', evening: 'band-score' },
  3: { morning: 'vocabulary', afternoon: 'speaking', evening: 'quiz' },
  4: { morning: 'writing', afternoon: 'reading-listening', evening: 'motivation' },
  5: { morning: 'vocabulary', afternoon: 'speaking', evening: 'quiz' },
  6: { morning: 'writing', afternoon: 'reading-listening', evening: 'band-score' },
};

/**
 * Get the current time slot based on Tashkent time
 * @returns {'morning' | 'afternoon' | 'evening'}
 */
export function getTimeSlot() {
  // Check if TIME_SLOT is set by GitHub Actions
  const envSlot = process.env.TIME_SLOT;
  if (envSlot && ['morning', 'afternoon', 'evening'].includes(envSlot)) {
    return envSlot;
  }

  // Auto-detect based on Tashkent time (UTC+5)
  const now = new Date();
  const tashkentHour = (now.getUTCHours() + 5) % 24;

  if (tashkentHour >= 6 && tashkentHour < 12) return 'morning';
  if (tashkentHour >= 12 && tashkentHour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Get the content type for the current day and time slot
 * @returns {string} Content type identifier
 */
export function getContentType() {
  // Check if forced content type is set
  const forcedType = process.env.CONTENT_TYPE;
  if (forcedType) return forcedType;

  const now = new Date();
  // Convert to Tashkent time for correct day
  const tashkentTime = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const dayOfWeek = tashkentTime.getUTCDay();
  const timeSlot = getTimeSlot();

  return SCHEDULE[dayOfWeek][timeSlot];
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
      // Reset all items to unused
      console.log(`🔄 All ${contentType} items used. Resetting...`);
      items.forEach((item) => (item.used = false));
      writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf-8');
      return items[Math.floor(Math.random() * items.length)];
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
