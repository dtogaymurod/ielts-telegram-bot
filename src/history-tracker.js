import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = join(__dirname, '..', 'content', 'history.json');
const MAX_HISTORY = 100;

export function getHistory(contentType) {
  try {
    if (!existsSync(HISTORY_FILE)) {
      return [];
    }
    const data = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
    return data[contentType] || [];
  } catch (error) {
    console.error('Error reading history:', error.message);
    return [];
  }
}

export function saveHistory(contentType, topic) {
  if (!topic) return;
  
  try {
    let data = {};
    if (existsSync(HISTORY_FILE)) {
      data = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
    }
    
    if (!data[contentType]) {
      data[contentType] = [];
    }
    
    // Check if it already exists to avoid duplicates
    if (!data[contentType].includes(topic)) {
      data[contentType].push(topic);
      // Keep only the last MAX_HISTORY items
      if (data[contentType].length > MAX_HISTORY) {
        data[contentType] = data[contentType].slice(-MAX_HISTORY);
      }
      
      writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
      console.log(`✅ Saved topic "${topic}" to history for ${contentType}`);
    }
  } catch (error) {
    console.error('Error saving history:', error.message);
  }
}
