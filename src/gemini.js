/**
 * Gemini AI Content Generator
 * Generates IELTS content using Google Gemini API
 */

import { GoogleGenAI } from '@google/genai';

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

const SYSTEM_INSTRUCTION = `Sen IELTS bo'yicha tajribali o'qituvchisan. Telegram kanalga post yozasan.

MUHIM QOIDALAR:
1. Tushuntirishlar va maslahatlarni O'ZBEK tilida yoz (lotin alifbosida)
2. Inglizcha misollar, ta'riflar va sample javoblarni INGLIZ tilida yoz
3. Telegram HTML formatidan foydalan: <b>qalin</b>, <i>kursiv</i>, <u>tagiga chizilgan</u>
4. Satr uzilishlari uchun \\n ishlatish
5. Emojilar ishlatish (lekin haddan oshirmaslik - har bir postda 4-8 ta)
6. Postni 3000 belgidan oshirma
7. Oxirida tegishli hashtaglar qo'sh: #IELTS #Vocabulary va h.k.
8. Kontent haqiqiy foydali bo'lsin - oddiy va tushunarli
9. Band 7+ darajaga mo'ljallangan bo'lsin`;

/**
 * Generate vocabulary post
 */
export async function generateVocabulary() {
  const client = getAI();
  if (!client) return null;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Bitta yangi IELTS vocabulary so'z haqida post yoz. 
        Quyidagilarni qo'sh:
        - So'z va transkriptsiyasi
        - So'z turkumi
        - Inglizcha ta'rif
        - O'zbekcha ma'no
        - 2 ta misol gap
        - Sinonim va antonim
        - IELTS da qanday ishlatish bo'yicha maslahat (o'zbekcha)
        
        Telegram HTML formatida yoz. Emojilar bilan chiroyli qilib format qil.`,
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
      contents: `IELTS Writing ${taskType} bo'yicha bitta foydali maslahat yoz.
        Quyidagilarni qo'sh:
        - Maslahat sarlavhasi (o'zbekcha va inglizcha)
        - Batafsil tushuntirish (o'zbekcha)
        - Yaxshi va yomon misol (inglizcha) - before/after format
        - Ko'p uchraydigan xato (o'zbekcha)
        - Band score ga ta'siri
        
        Telegram HTML formatida yoz.`,
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
      contents: `IELTS Speaking ${part} bo'yicha bitta foydali maslahat yoz.
        Quyidagilarni qo'sh:
        - Mavzu/savol (inglizcha)
        - Strategiya (o'zbekcha)
        - Namuna javob (inglizcha, Band 7+ darajada)
        - Foydali iboralar ro'yxati (inglizcha)
        - Qo'shimcha maslahat (o'zbekcha)
        
        Telegram HTML formatida yoz.`,
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
      contents: `IELTS ${skill} bo'yicha bitta strategiya yoz.
        Quyidagilarni qo'sh:
        - Strategiya nomi (o'zbekcha va inglizcha)
        - Qanday qilib ishlashi (o'zbekcha, qadamma-qadam)
        - Qaysi savol turlari uchun foydali
        - Amaliy misol yoki mashq
        - Ko'p uchraydigan xato (o'zbekcha)
        
        Telegram HTML formatida yoz.`,
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
      contents: `IELTS band scoreni ${band} oshirish bo'yicha amaliy maslahat yoz.
        Quyidagilarni qo'sh:
        - Aniq maqsad (band score)
        - Nima qilish kerak (o'zbekcha, aniq qadamlar)
        - Before/After misol (inglizcha)
        - Muhim kalit nuqta (o'zbekcha)
        
        Telegram HTML formatida yoz.`,
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
      contents: `IELTS tayyorlanayotgan talabalar uchun motivatsion post yoz.
        Quyidagilardan birini tanlash mumkin:
        - IELTS muvaffaqiyat hikoyasi (xayoliy lekin realastik)
        - Motivatsion iqtibos va sharh
        - Amaliy qadamlar bilan rag'batlantiruvchi xabar
        
        Quyidagilarni qo'sh:
        - Hikoya yoki iqtibos
        - Saboq/xulosa (o'zbekcha)
        - Bugungi amaliy qadam (o'zbekcha)
        
        Telegram HTML formatida yoz. Ilhomlantiruvchi va samimiy bo'lsin.`,
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
      contents: `You are an expert IELTS examiner. Search your knowledge for a recently reported IELTS Speaking Part ${part} question from 2026 or 2025 (e.g. from global or Uzbekistan exams).
      
      Generate a Telegram post based on this question.
      Include:
      - The Question (in English)
      - O'zbekcha tarjimasi
      - Band 8.0-9.0 Sample Answer (in English)
      - 3-5 useful vocabulary words from the answer with definitions in Uzbek
      
      Write the post entirely in Telegram HTML format (<b>, <i>, <u>). Use engaging emojis. Keep it under 2500 characters.`,
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
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert IELTS examiner. Think of a recently reported IELTS Writing Task ${task} question from 2026 or 2025 (e.g. from global or Uzbekistan exams).
      
      Generate a Telegram post for this question.
      Include:
      - The exact prompt/question (in English)
      - O'zbekcha tarjimasi
      - A quick outline of Ideas/Structure (Agree/Disagree points if Task 2, or Main trends if Task 1)
      - 3-5 advanced Band 8.0+ vocabulary words to use in this essay, with translations in Uzbek
      
      Write the post entirely in Telegram HTML format (<b>, <i>, <u>). Use engaging emojis. Keep it under 3000 characters.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.85,
        maxOutputTokens: 2048,
      },
    });
    let text = response.text;
    text = `🚨 <b>RECENT EXAM QUESTION: WRITING TASK ${task}</b> 🚨\n\n` + text;
    return text;
  } catch (error) {
    console.error('❌ Gemini recent writing generation failed:', error.message);
    return null;
  }
}
