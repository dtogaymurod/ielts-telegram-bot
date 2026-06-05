/**
 * Telegram Bot API module
 * Handles sending messages, photos, and quizzes to a Telegram channel
 */

import { readFileSync } from 'fs';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * Make a request to the Telegram Bot API with retry logic
 */
async function telegramRequest(method, body, retries = 3) {
  const url = `${BASE_URL}/${method}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!data.ok) {
        // Handle rate limiting
        if (data.error_code === 429 && data.parameters?.retry_after) {
          const waitSeconds = data.parameters.retry_after;
          console.log(`⏳ Rate limited. Waiting ${waitSeconds}s...`);
          await sleep(waitSeconds * 1000);
          continue;
        }
        throw new Error(`Telegram API error [${data.error_code}]: ${data.description}`);
      }

      return data.result;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      console.log(`⚠️ Attempt ${attempt} failed: ${error.message}. Retrying...`);
      await sleep(1000 * attempt); // Exponential backoff
    }
  }
}

/**
 * Send a text message to the channel
 * @param {string} text - HTML formatted text (max 4096 chars)
 * @param {object} options - Additional options
 */
export async function sendMessage(text, options = {}) {
  return telegramRequest('sendMessage', {
    chat_id: CHANNEL_ID,
    text: text,
    parse_mode: 'HTML',
    disable_web_page_preview: options.disablePreview ?? true,
    ...options.extra,
  });
}

/**
 * Send a quiz/poll to the channel
 * @param {string} question - Quiz question (max 300 chars)
 * @param {string[]} options - Answer options (2-10 items, max 100 chars each)
 * @param {number} correctIndex - Index of the correct answer (0-based)
 * @param {string} explanation - Explanation shown after answering (max 200 chars)
 */
export async function sendQuiz(question, options, correctIndex, explanation = '') {
  return telegramRequest('sendPoll', {
    chat_id: CHANNEL_ID,
    question: question,
    options: options,
    type: 'quiz',
    correct_option_id: correctIndex,
    explanation: explanation,
    explanation_parse_mode: 'HTML',
    is_anonymous: true,
  });
}

/**
 * Send a photo with caption to the channel
 * @param {string} photoUrl - URL of the photo
 * @param {string} caption - HTML formatted caption (max 1024 chars)
 */
export async function sendPhoto(photoUrl, caption = '') {
  return telegramRequest('sendPhoto', {
    chat_id: CHANNEL_ID,
    photo: photoUrl,
    caption: caption,
    parse_mode: 'HTML',
  });
}

/**
 * Send a local photo file to the channel
 * @param {string} filePath - Path to the local photo
 * @param {string} caption - HTML formatted caption (max 1024 chars)
 */
export async function sendLocalPhoto(filePath, caption = '') {
  const url = `${BASE_URL}/sendPhoto`;
  const formData = new FormData();
  formData.append('chat_id', CHANNEL_ID);
  
  const fileBuffer = readFileSync(filePath);
  const blob = new Blob([fileBuffer]);
  formData.append('photo', blob, 'photo.jpg');
  
  formData.append('caption', caption);
  formData.append('parse_mode', 'HTML');

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      
      if (!data.ok) {
        if (data.error_code === 429 && data.parameters?.retry_after) {
          const waitSeconds = data.parameters.retry_after;
          console.log(`⏳ Rate limited. Waiting ${waitSeconds}s...`);
          await sleep(waitSeconds * 1000);
          continue;
        }
        throw new Error(`Telegram API error [${data.error_code}]: ${data.description}`);
      }
      return data.result;
    } catch (error) {
      if (attempt === 3) throw error;
      console.log(`⚠️ Attempt ${attempt} failed: ${error.message}. Retrying...`);
      await sleep(1000 * attempt);
    }
  }
}

/**
 * Send a local document (file) to the channel
 * @param {string} filePath - Path to the local file
 * @param {string} fileName - Name of the file to display in Telegram
 * @param {string} caption - HTML formatted caption (max 1024 chars)
 */
export async function sendDocument(filePath, fileName, caption = '') {
  const url = `${BASE_URL}/sendDocument`;
  const formData = new FormData();
  formData.append('chat_id', CHANNEL_ID);
  
  const fileBuffer = readFileSync(filePath);
  const blob = new Blob([fileBuffer]);
  formData.append('document', blob, fileName);
  
  formData.append('caption', caption);
  formData.append('parse_mode', 'HTML');

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      
      if (!data.ok) {
        if (data.error_code === 429 && data.parameters?.retry_after) {
          const waitSeconds = data.parameters.retry_after;
          console.log(`⏳ Rate limited. Waiting ${waitSeconds}s...`);
          await sleep(waitSeconds * 1000);
          continue;
        }
        throw new Error(`Telegram API error [${data.error_code}]: ${data.description}`);
      }
      return data.result;
    } catch (error) {
      if (attempt === 3) throw error;
      console.log(`⚠️ Attempt ${attempt} failed: ${error.message}. Retrying...`);
      await sleep(1000 * attempt);
    }
  }
}

/**
 * Validate that required environment variables are set
 */
export function validateConfig() {
  const missing = [];
  if (!process.env.TELEGRAM_BOT_TOKEN) missing.push('TELEGRAM_BOT_TOKEN');
  if (!process.env.TELEGRAM_CHANNEL_ID) missing.push('TELEGRAM_CHANNEL_ID');

  if (missing.length > 0) {
    throw new Error(`❌ Missing environment variables: ${missing.join(', ')}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
