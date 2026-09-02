import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPEAKING_DIR = path.join(__dirname, '..', 'Speaking');

function cleanText(text) {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/🟢.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parsePart1Topics() {
  const content = fs.readFileSync(path.join(SPEAKING_DIR, 'Part_1.md'), 'utf-8');
  const sections = content.split(/^##\s+/m).slice(1);
  const topics = [];

  for (const sec of sections) {
    const lines = sec.trim().split('\n');
    const rawTitle = lines[0];
    if (rawTitle.includes('Mundarija') || rawTitle.includes('Table of Contents')) continue;

    const title = cleanText(rawTitle);
    const questionMatches = sec.match(/###\s+Savol\s+\d+[\r\n]+([^#\n\r>]+)/g);
    const questions = [];

    if (questionMatches) {
      for (const qm of questionMatches) {
        const qText = cleanText(qm.replace(/###\s+Savol\s+\d+/, ''));
        if (qText && !qText.startsWith('**Sample') && !qText.startsWith('>') && qText.length > 5) {
          questions.push(qText);
        }
      }
    }

    if (title && questions.length > 0) {
      topics.push({ title, questions });
    }
  }
  return topics;
}

export function parsePart2Topics() {
  const content = fs.readFileSync(path.join(SPEAKING_DIR, 'Part_2.md'), 'utf-8');
  const sections = content.split(/^##\s+/m).slice(1);
  const topics = [];

  for (const sec of sections) {
    const lines = sec.trim().split('\n');
    const rawTitle = lines[0];
    if (rawTitle.includes('Mundarija') || rawTitle.includes('Table of Contents')) continue;

    const title = cleanText(rawTitle);
    const promptMatch = sec.match(/###\s+Savol\s+\d+[\r\n]+([^\n\r]+)/);
    const prompt = promptMatch ? cleanText(promptMatch[1]) : `Describe ${title.toLowerCase()}`;

    const bulletMatches = sec.match(/[•\*\-]\s+([^\n\r<]+)/g);
    const bullets = [];
    if (bulletMatches) {
      for (const b of bulletMatches) {
        const cleaned = cleanText(b.replace(/^[•\*\-]\s+/, ''));
        if (cleaned && !cleaned.startsWith('(1 ta') && !cleaned.startsWith('(') && cleaned.length > 3) {
          bullets.push(cleaned);
        }
      }
    }

    if (title) {
      topics.push({
        title,
        prompt: prompt || `Describe ${title}`,
        bullets: bullets.length > 0 ? bullets : ['who/what this is', 'when/where it took place', 'how you felt about it']
      });
    }
  }
  return topics;
}

export function parsePart3Topics() {
  const content = fs.readFileSync(path.join(SPEAKING_DIR, 'Part_3.md'), 'utf-8');
  const sections = content.split(/^##\s+/m).slice(1);
  const topics = [];

  for (const sec of sections) {
    const lines = sec.trim().split('\n');
    const rawTitle = lines[0];
    if (rawTitle.includes('Mundarija') || rawTitle.includes('Table of Contents')) continue;

    const title = cleanText(rawTitle);
    const questionMatches = sec.match(/###\s+Savol\s+\d+[\r\n]+([^#\n\r>]+)/g);
    const questions = [];

    if (questionMatches) {
      for (const qm of questionMatches) {
        const qText = cleanText(qm.replace(/###\s+Savol\s+\d+/, ''));
        if (qText && !qText.startsWith('**Sample') && !qText.startsWith('>') && qText.length > 5) {
          questions.push(qText);
        }
      }
    }

    if (title && questions.length > 0) {
      topics.push({ title, questions });
    }
  }
  return topics;
}
