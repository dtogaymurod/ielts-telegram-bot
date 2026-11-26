/**
 * Send one agent post from content/agent-queue.json to its Telegram channel now.
 *   node scripts/post-now.js <post id>               send it
 *   node scripts/post-now.js <post id> <message id>  swap the picture of the
 *                                                     channel message already sent
 *                                                     (text-only post: its text and button are replaced)
 * Instagram posts (ig_ustoz) go to the mock site's Instagram queue.
 * Only posts the teacher approved in the project thread ("approved_in") go out.
 */
import { loadQueue, postNow, replacePhoto, editText, publishInstagramDraft } from '../src/agent-posts.js';

const [id, messageId] = process.argv.slice(2);
const post = loadQueue().find((p) => p.id === id);
if (!post) {
  console.error(`No post with id "${id}" in content/agent-queue.json`);
  process.exit(1);
}
if (messageId && !post.images?.length) {
  await editText(post, messageId);
  console.log(`✅ Text of message ${messageId} replaced with ${id} rev ${post.rev || 1}`);
} else if (messageId) {
  await replacePhoto(post, messageId);
  console.log(`✅ Picture of message ${messageId} replaced with ${post.images[0]}`);
} else if (post.channel === 'ig_ustoz') {
  // Instagram: straight to the mock site's Instagram queue (Make posts it), same as an approved 21:00 draft
  if (!post.approved_in) throw new Error(`Post ${id} has no "approved_in": approve it first`);
  await publishInstagramDraft({ meta: { ...post, agent_id: post.id } }, post.date);
  console.log(`✅ Queued ${id} for Instagram`);
} else {
  await postNow(post);
  console.log(`✅ Posted ${id} to ${post.channel}`);
}
