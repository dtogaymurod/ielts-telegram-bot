/**
 * Script to publish magazine with the approved caption
 */

import { sendDocument, sendDocumentByFileId, validateConfig } from '../src/telegram.js';
import fs from 'fs';

validateConfig();

export const MAGAZINE_CAPTION = `📖 <b>IELTS Reading'da 7.0+ olishning eng katta siri nima?</b>

Faqat test yechaverish bilan reading oshib qolmaydi. Chunki imtihondagi matnlar maxsus darslik emas, balki real, nufuzli jurnallardan olinadi.

Har kuni inglizcha <b>authentic</b> (haqiqiy) jurnallarni 15 daqiqa mutolaa qilish sizga:
• Uzun matnlarni charchamasdan o‘qish ko‘nikmasini beradi;
• Band 7+ akademik so‘zlarni kontekstda eslab qolishga yordam beradi;
• Writing Task 2 uchun kuchli g‘oyalar bazasini yaratadi.

Sizlar uchun reading darajangizni tubdan o‘stiradigan ajoyib jurnalni ilova qilyapman. Yuklab oling va bugunoq bitta qiziqarli maqolani o‘qib chiqing! 📑👇

👉 Telegram: @dilshod_english
📸 Instagram: instagram.com/dilshod.ustoz`;

async function publishFromBotInbox() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=-15`);
  const data = await res.json();

  if (!data.ok || !data.result) {
    console.log('No updates found.');
    return;
  }

  // Find latest document forwarded to bot
  const docMessages = data.result
    .filter(u => u.message && u.message.document)
    .map(u => u.message);

  if (docMessages.length === 0) {
    console.log('No forwarded documents in bot inbox yet.');
    return;
  }

  console.log(`Found ${docMessages.length} document(s) in bot inbox.`);

  // Publish each document (first one with full caption, subsequent with title)
  for (let i = 0; i < docMessages.length; i++) {
    const msg = docMessages[i];
    const doc = msg.document;
    const caption = i === 0 ? MAGAZINE_CAPTION : `📑 <b>${doc.file_name || 'Magazine'}</b>\n\n👉 @dilshod_english`;
    
    console.log(`Publishing document: ${doc.file_name}...`);
    const result = await sendDocumentByFileId(doc.file_id, caption);
    console.log(`✅ Document ${i + 1} published! Message ID: ${result.message_id}`);
  }
}

// Check CLI arg for local file, else check inbox
const localPath = process.argv[2];
if (localPath && fs.existsSync(localPath)) {
  const fileName = process.argv[3] || 'IELTS_Authentic_Magazine.pdf';
  console.log(`Publishing local file ${localPath}...`);
  sendDocument(localPath, fileName, MAGAZINE_CAPTION)
    .then(res => console.log(`✅ Successfully published! Message ID: ${res.message_id}`))
    .catch(err => console.error('❌ Error publishing:', err.message));
} else {
  publishFromBotInbox().catch(err => console.error('❌ Error:', err.message));
}
