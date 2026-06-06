/**
 * Gemini AI Content Generator
 * Generates IELTS content using Google Gemini API
 */

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

let ai = null;

function getAI() {
  if (!ai) {
    if (!process.env.GEMINI_API_KEY) {
      return null;
    }
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

const SYSTEM_INSTRUCTION = `Sen IELTS bo'yicha tajribali, zamonaviy va do'stona o'qituvchisan. Telegram kanalga o'quvchilar bilan suhbatlashgandek, samimiy va jonli post yozasan.

MUHIM QOIDALAR:
1. Qisqalik va londa bo'lish: Postlar o'qishga oson, ixcham bo'lishi shart. Keraksiz va cho'zilgan gaplardan saqlan. Asosiy fikrni tez va aniq yetkaz (maksimum 1500-2000 belgi).
2. Tabiiy O'zbek tili: Ingliz tilidan so'zma-so'z tarjima qilingan (robotic) sun'iy jumlalardan mutlaqo qoch. Xuddi tirik inson o'zbek tilida gapirayotgandek, tabiiy, ravon va grammatik jihatdan to'g'ri yoz.
3. Qolipdan qochish: Har bir post bir xil, zerikarli shablonda bo'lmasin. Tabiiy ko'rinish uchun formatlashni o'zgartirib tur.
4. Inglizcha qismlar: Misollar, so'zlar va namunaviy javoblar aslicha (ingliz tilida) qolsin.
5. Formatlash: Telegram HTML (<b>, <i>, <u>) dan o'z o'rnida foydalan. Paragraflar orasida bo'sh joy qoldir.
6. Emojilar: O'z o'rnida, tabiiy va kamroq ishlat (postda 2-4 ta).
7. Band 7+ daraja: Ingliz tili materiallari haqiqatan ham ilg'or darajadagi o'quvchilar uchun mo'ljallangan bo'lsin.`;

/**
 * Generate vocabulary post
 */
export async function generateVocabulary() {
  const client = getAI();
  if (!client) return null;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Bitta yangi ilg'or darajadagi IELTS vocabulary so'zini o'rgatuvchi qisqa va qiziqarli post yoz.
        Quyidagilarni o'z ichiga olsin:
        - So'z va uning o'zbekcha aniq ma'nosi
        - 1-2 ta eslab qolish oson bo'lgan, sifatli misol gap (inglizcha)
        - IELTS (Writing yoki Speaking) da bu so'zni qanday qilib o'rinli ishlatish bo'yicha qisqacha do'stona maslahat (o'zbek tilida).
        
        Qattiq qoliplarga tushma. O'quvchini zeriktirmaydigan, ixcham va tabiiy formatda yoz. Ortqicha va keraksiz ma'lumotlarni (masalan uzun sinonimlar ro'yxatini) olib tashla.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.9,
        maxOutputTokens: 2048,
      },
    });
    return response.text;
  } catch (error) {
    console.error('❌ Gemini vocabulary generation failed:', error.message);
    return null;
  }
}

/**
 * Generate writing tips post
 */
export async function generateWritingTip() {
  const client = getAI();
  if (!client) return null;

  try {
    const taskType = Math.random() > 0.5 ? 'Task 1' : 'Task 2';
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `IELTS Writing ${taskType} bo'yicha bitta juda muhim va qisqa maslahat yoz.
        Quyidagilar bo'lsin:
        - Maslahat nima haqida ekanligi (jonli sarlavha)
        - Qisqa va lo'nda tushuntirish (o'zbekcha, do'stona ohangda)
        - Kichik bir before/after misol (inglizcha)
        
        Post xuddi tajribali ustoz o'quvchisiga Telegramda tezkor maslahat bergandek qisqa va tabiiy o'qilsin. Qolipga tushgan sun'iy tuzilmalardan saqlan.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.8,
        maxOutputTokens: 2048,
      },
    });
    return response.text;
  } catch (error) {
    console.error('❌ Gemini writing tip generation failed:', error.message);
    return null;
  }
}

/**
 * Generate speaking tips post
 */
export async function generateSpeakingTip() {
  const client = getAI();
  if (!client) return null;

  try {
    const parts = ['Part 1', 'Part 2', 'Part 3'];
    const part = parts[Math.floor(Math.random() * parts.length)];

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `IELTS Speaking ${part} bo'yicha 1 ta foydali va qisqa maslahat yoz.
        Quyidagilar bo'lsin:
        - Aniq bir Speaking savoli (inglizcha)
        - Qanday qilib yaxshi javob berish siri (o'zbekcha, 1-2 gapda)
        - Qisqa va tabiiy Namuna javob (inglizcha, Band 7.5+ darajada)
        - Javob ichidagi 2 ta kuchli ibora va ularning ma'nosi.
        
        Matn sun'iy tarjimaga o'xshamasin, xuddi o'zbek o'qituvchisi to'g'ridan-to'g'ri tushuntirayotgandek jonli, ixcham va o'qishga qulay bo'lsin.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.85,
        maxOutputTokens: 2048,
      },
    });
    return response.text;
  } catch (error) {
    console.error('❌ Gemini speaking tip generation failed:', error.message);
    return null;
  }
}

/**
 * Generate reading/listening strategy post
 */
export async function generateReadingListeningStrategy() {
  const client = getAI();
  if (!client) return null;

  try {
    const skill = Math.random() > 0.5 ? 'Reading' : 'Listening';
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `IELTS ${skill} bo'yicha bitta kuchli va qisqa strategiya o'rgat.
        Tuzilishi:
        - Strategiyaning qiziqarli nomi
        - U nima ekanligi va qanday ishlashi (qisqa, oddiy so'zlar bilan o'zbek tilida)
        - Bitta amaliy misol
        
        Sun'iy, "robot"ga o'xshash matnlardan qoch! Tirik inson, do'stona va oson tushuniladigan tarzda yozsin. Juda uzun bo'lmasin.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.8,
        maxOutputTokens: 2048,
      },
    });
    return response.text;
  } catch (error) {
    console.error('❌ Gemini reading/listening generation failed:', error.message);
    return null;
  }
}

/**
 * Generate band score improvement tip
 */
export async function generateBandScoreTip() {
  const client = getAI();
  if (!client) return null;

  try {
    const bands = ['6.0 dan 6.5 ga', '6.5 dan 7.0 ga', '7.0 dan 7.5 ga', '7.5 dan 8.0 ga'];
    const band = bands[Math.floor(Math.random() * bands.length)];

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `IELTS dan ${band} band olish siri haqida qisqacha maslahat yoz.
        Faqat 1 ta eng muhim qoidani tushuntir.
        - Nima qilish kerakligi (o'zbekcha, sodda tilda)
        - Farqni ko'rsatish uchun 1 ta Before/After misol (inglizcha).
        
        Zerikarli qoliplardan chiq. Oddiy so'zlar bilan, ammo kuchli ma'noli qilib yoz. Post qisqa bo'lsin.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.85,
        maxOutputTokens: 2048,
      },
    });
    return response.text;
  } catch (error) {
    console.error('❌ Gemini band score tip generation failed:', error.message);
    return null;
  }
}

/**
 * Generate motivational post
 */
export async function generateMotivation() {
  const client = getAI();
  if (!client) return null;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `IELTS ga tayyorlanayotganlar uchun qisqa va ta'sirli motivatsion post yoz.
        Yoki bitta qisqa muvaffaqiyat hikoyasi (1-2 gap), yoki kuchli motivatsion iqtibos bo'lsin.
        Oxirida bugun bajarish uchun 1 ta oddiy, qisqa vazifa ber (masalan, "Bugun 1 ta podcast eshiting").
        
        Ohang: Samimiy, ilhomlantiruvchi, xuddi yaqin do'stdek. Ortiqcha cho'zilgan jumlalar kerak emas.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.95,
        maxOutputTokens: 2048,
      },
    });
    return response.text;
  } catch (error) {
    console.error('❌ Gemini motivation generation failed:', error.message);
    return null;
  }
}

/**
 * Generate a quiz question
 * Returns structured data for sendPoll API
 */
export async function generateQuiz() {
  const client = getAI();
  if (!client) return null;

  try {
    const categories = ['vocabulary', 'grammar', 'collocations', 'error correction'];
    const category = categories[Math.floor(Math.random() * categories.length)];

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `IELTS ${category} bo'yicha bitta quiz savoli yarat.
        
        QATTIQ FORMAT (faqat JSON qaytar, boshqa hech narsa yo'q):
        {
          "question": "Savol matni (inglizcha, 300 belgidan kam)",
          "options": ["Variant A", "Variant B", "Variant C", "Variant D"],
          "correct_index": 0,
          "explanation_uz": "To'g'ri javob tushuntirishi (o'zbekcha, 200 belgidan kam)"
        }`,
      config: {
        systemInstruction: 'Faqat valid JSON qaytar. Boshqa hech qanday matn yoki markdown yozma.',
        temperature: 0.8,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    });

    const quiz = JSON.parse(response.text);

    // Validate structure
    if (!quiz.question || !Array.isArray(quiz.options) || quiz.options.length < 2 || typeof quiz.correct_index !== 'number') {
      console.error('❌ Invalid quiz structure from Gemini');
      return null;
    }

    return quiz;
  } catch (error) {
    console.error('❌ Gemini quiz generation failed:', error.message);
    return null;
  }
}

/**
 * Generate a reading test with AI
 * @returns {Promise<object|null>} JSON object with reading test data
 */
export async function generateReadingTest() {
  const client = getAI();
  if (!client) return null;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert IELTS examiner. Generate an IELTS Reading passage and 5 Multiple Choice questions.
      
      The passage should be:
      - 250-350 words long
      - Divided into exactly 4 paragraphs
      - Academic or semi-academic topic (e.g., science, history, environment, psychology)
      - Interesting and engaging
  
      Then create 5 Multiple Choice questions based on the text:
      - Each question must have exactly 4 options (A, B, C, D)
      - Only one option should be correct
      - The options should test reading comprehension, not just vocabulary matching
  
      QATTIQ FORMAT (faqat JSON qaytar, boshqa hech narsa yo'q):
      {
        "title": "The Title of the Passage",
        "paragraphs": [
          "First paragraph text without any newlines or unescaped quotes...",
          "Second paragraph text..."
        ],
        "questions": [
          {
            "question": "1. What is the main idea of...",
            "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
            "correct_index": 2
          }
        ]
      }`,
      config: {
        systemInstruction: 'Faqat valid JSON qaytar. Do not use unescaped quotes (") or newlines (\\n) inside string values. Boshqa hech qanday matn yoki markdown yozma.',
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    });

    const testData = JSON.parse(response.text);

    // Validate structure
    if (!testData.title || !Array.isArray(testData.paragraphs) || !Array.isArray(testData.questions)) {
      console.error('❌ Invalid reading test structure from Gemini');
      return null;
    }

    return testData;
  } catch (error) {
    console.error('❌ Gemini reading test generation failed:', error.message);
    return null;
  }
}

/**
 * Generate a recent IELTS speaking post
 * @param {number} part - 1, 2, or 3
 */
export async function generateRecentSpeaking(part) {
  const client = getAI();
  if (!client) return null;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Siz tajribali IELTS examiner'isiz. 2025 yoki 2026 yilda (Global yoki O'zbekistonda) haqiqiy imtihonda tushgan IELTS Speaking Part ${part} savolini o'ylab toping.
      
      Shu savol asosida Telegram kanali uchun post yozing.
      Post ixcham va tabiiy bo'lsin:
      - Haqiqiy savol (inglizcha) va uning qisqa o'zbekcha tarjimasi
      - Band 8.0+ darajadagi namunaviy javob (inglizcha, juda uzun bo'lmasin)
      - Javobdan olingan 2-3 ta kuchli so'z/ibora va ularning qisqa o'zbekcha ma'nosi.
      
      Sun'iy shablonlardan (masalan, yodlangan ro'yxatlardan) foydalanmang. Jonli, o'qishli va tabiiy matn yarating.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.85,
        maxOutputTokens: 2048,
      },
    });
    let text = response.text;
    text = `🚨 <b>RECENT EXAM QUESTION: SPEAKING PART ${part}</b> 🚨\n\n` + text;
    return text;
  } catch (error) {
    console.error('❌ Gemini recent speaking generation failed:', error.message);
    return null;
  }
}

/**
 * Generate a recent IELTS writing post
 * @param {number} task - 1 or 2
 */
export async function generateRecentWriting(task) {
  const client = getAI();
  if (!client) return null;

  try {
    const promptText = `Siz tajribali IELTS examiner'isiz. 2025 yoki 2026 yilda (Global yoki O'zbekistonda) haqiqiy imtihonda tushgan IELTS Writing Task 2 savolini o'ylab toping.
      
      Shu savol asosida Telegram kanali uchun post yozing.
      Post ixcham va jonli bo'lsin:
      - Essay savoli (inglizcha) va qisqa o'zbekcha tarjimasi
      - Qanday g'oyalar (Ideas) yozish bo'yicha juda qisqa (bullet-point) reja (o'zbek yoki ingliz tilida)
      - Essayda ishlatish mumkin bo'lgan 3 ta kuchli (Band 8+) so'z va ularning tarjimasi.
      
      Qotib qolgan shablonlardan qoching. Post xuddi o'qituvchi o'z o'quvchilariga foydali ma'lumot ulashayotgandek tabiiy, lo'nda va o'zbek tilida ravon bo'lsin.`;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptText,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.85,
        maxOutputTokens: 2048,
      },
    });

    const rawText = response.text.trim();
    return `🚨 <b>RECENT EXAM QUESTION: WRITING TASK 2</b> 🚨\n\n` + rawText;
  } catch (error) {
    console.error('❌ Gemini recent writing generation failed:', error.message);
    return null;
  }
}
