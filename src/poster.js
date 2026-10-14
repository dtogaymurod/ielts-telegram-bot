/**
 * Poster generator — turns a daily post into a branded PNG image.
 *
 * The picture is drawn from a fixed template (poster/render_post.py, Pillow),
 * so the text on it is always sharp and spelled exactly like the post.
 * Returns null on any failure so the bot can fall back to a text-only post.
 */

import { execFileSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_SCRIPT = join(__dirname, '..', 'poster', 'render_post.py');

// Telegram counts the caption limit on the text without HTML tags
export const CAPTION_LIMIT = 1024;

export function captionLength(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|apos);/g, '_').length;
}

export function renderPoster(postText) {
  try {
    const outPath = join(mkdtempSync(join(tmpdir(), 'poster-')), 'poster.png');
    execFileSync('python3', [RENDER_SCRIPT, '-', outPath], {
      input: postText,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60_000,
    });
    return outPath;
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    console.warn(`⚠️ Poster rendering failed, posting text only: ${detail}`);
    return null;
  }
}
