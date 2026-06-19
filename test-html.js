import { sendMessage } from './src/telegram.js';
async function test() {
  try {
    const res = await sendMessage("Sun'iy intellekt va virtual reallik texnologiyalari (<AI> va <VR>) shunday bo'ladi.");
    console.log("Success:", res.message_id);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
