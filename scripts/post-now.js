/**
 * Send one agent post from content/agent-queue.json to its Telegram channel now.
 *   node scripts/post-now.js <post id>
 * Only posts the teacher approved in the project thread ("approved_in") go out.
 */
import { loadQueue, postNow } from '../src/agent-posts.js';

const id = process.argv[2];
const post = loadQueue().find((p) => p.id === id);
if (!post) {
  console.error(`No post with id "${id}" in content/agent-queue.json`);
  process.exit(1);
}
await postNow(post);
console.log(`✅ Posted ${id} to ${post.channel}`);
