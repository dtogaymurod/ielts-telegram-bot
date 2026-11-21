/**
 * Send one agent post from content/agent-queue.json to its Telegram channel now.
 *   node scripts/post-now.js <post id>               send it
 *   node scripts/post-now.js <post id> <message id>  swap the picture of the
 *                                                     channel message already sent
 * Only posts the teacher approved in the project thread ("approved_in") go out.
 */
import { loadQueue, postNow, replacePhoto } from '../src/agent-posts.js';

const [id, messageId] = process.argv.slice(2);
const post = loadQueue().find((p) => p.id === id);
if (!post) {
  console.error(`No post with id "${id}" in content/agent-queue.json`);
  process.exit(1);
}
if (messageId) {
  await replacePhoto(post, messageId);
  console.log(`✅ Picture of message ${messageId} replaced with ${post.images[0]}`);
} else {
  await postNow(post);
  console.log(`✅ Posted ${id} to ${post.channel}`);
}
