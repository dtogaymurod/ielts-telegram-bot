/**
 * Telegraph (telegra.ph) module — publishes long-form pages that open
 * inside Telegram as Instant View with one tap.
 *
 * Optional env: TELEGRAPH_ACCESS_TOKEN. Without it a fresh Telegraph
 * account is created for each run (free, no sign-up needed).
 */

const API = 'https://api.telegra.ph';
const AUTHOR_NAME = 'Dilshod Ustoz | IELTS';
const AUTHOR_URL = 'https://t.me/dilshod_english';

async function call(method, params) {
  const response = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`Telegraph ${method} failed: ${data.error}`);
  return data.result;
}

async function getToken() {
  if (process.env.TELEGRAPH_ACCESS_TOKEN) return process.env.TELEGRAPH_ACCESS_TOKEN;
  const account = await call('createAccount', {
    short_name: 'dilshod_english',
    author_name: AUTHOR_NAME,
    author_url: AUTHOR_URL,
  });
  return account.access_token;
}

/**
 * Turn "text with **bold** words" into Telegraph nodes.
 */
export function inlineNodes(text) {
  return text
    .split(/(\*\*.+?\*\*)/g)
    .filter(Boolean)
    .map((part) => (part.startsWith('**') ? { tag: 'strong', children: [part.slice(2, -2)] } : part));
}

/**
 * Publish a page and return its URL.
 * @param {string} title - Page title (max 256 chars)
 * @param {Array} content - Telegraph Node array
 */
export async function createPage(title, content) {
  const page = await call('createPage', {
    access_token: await getToken(),
    title: title.slice(0, 256),
    author_name: AUTHOR_NAME,
    author_url: AUTHOR_URL,
    content,
  });
  return page.url;
}
