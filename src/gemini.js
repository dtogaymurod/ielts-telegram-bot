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
1. Qisqalik: Odamlarni zeriktirmaslik uchun imkon qadar qisqa va londa yozing, LEKIN kerakli barcha qismlarni to'liq yozing va GAPNI CHALA QOLDIRMANG. Har bir post mantiqan to'liq yakunlangan bo'lishi shart! (Odatda 100-200 so'z atrofida bo'lsin, agar mavzu talab qilsa sal ko'proq bo'lishi mumkin).
2. Kirish so'zlarisiz (No Greetings): "Salom do'stlar", "Assalomu alaykum", "Hammaga salom", "Bugun biz..." kabi kirish yoki salomlashish so'zlarini umuman ishlatmang! To'g'ridan-to'g'ri asosiy qoidaga, maslahatga yoki so'zga o'tib keting. Xayrlashish ham shart emas!
3. Tabiiy O'zbek tili: Xuddi o'zbek o'qituvchisi to'g'ridan-to'g'ri Telegramda tezkor xabar yozayotgandek jonli yoz. Sun'iy va yodlangan jumlalardan qoch.
4. Inglizcha qismlar: Misollar, so'zlar va namunaviy javoblar aslicha (ingliz tilida) qolsin, lekin 1-2 gapdan oshmasin.
5. Formatlash: FAQAT Telegram HTML (<b>, <i>, <u>, <s>) dan foydalaning. **Markdown** yulduzchalari (**so'z**) QAT'IYAN TAQIQLANADI! Hech qachon so'zlarni ikkita yulduzcha orasiga olmang!
6. Emojilar: O'z o'rnida, 2-3 tagacha.
7. Band 7+ daraja: Ingliz tili materiallari ilg'or o'quvchilar uchun foydali bo'lsin.`;

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
      contents: `IELTS Speaking ${part} bo'yicha bitta qisqa va kuchli maslahat yoz.
        Quyidagilar bo'lishi shart (hech narsa tushib qolmasin):
        - Aniq bir Speaking savoli (inglizcha)
        - Shu savolga yaxshi javob berish siri (o'zbekcha, atigi 1 ta gapda)
        - Kichik Namuna javob (inglizcha, atigi 2-3 ta qisqa gap, Band 7.5+ darajada)
        - Javobdagi 1 ta eng kuchli ibora va o'zbekcha tarjimasi.
        
        Matn sun'iy bo'lmasin. Fikrni oxiriga yetkaz, matn chala uzilib qolmasligiga qat'iy e'tibor ber!`,
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
      contents: `IELTS o'qiyotgan o'quvchilarda tez-tez uchraydigan haqiqiy psixologik yoki o'quv muammosi haqida (masalan: charchash, bir xil ballda qotib qolish, imtihon oldi qo'rquvi, vaqt yetishmasligi) xuddi yaqin do'st yoki g'amxo'r ustoz sifatida samimiy post yozing.
      
      QAT'IY TALABLAR:
      1. Uydirma qahramonlar (masalan, "Bir kuni Ali ismli yigit 5.5 oldi...") QAT'IYAN TAQIQLANADI! Hikoya to'qimang.
      2. To'g'ridan-to'g'ri o'quvchining o'ziga, uning his-tuyg'ulariga murojaat qiling. Uni tushunayotganingizni, bu normal holat ekanligini bildiring.
      3. "Taslim bo'lmang", "Maqsad sari intiling", "Hech qachon to'xtamang" kabi o'ta shablon va pafosli (balandparvoz) so'zlardan U-MU-MAN foydalanmang.
      4. Buning o'rniga bitta juda oddiy, amaliy va psixologik yechim/maslahat bering (masalan: "bugun umuman ingliz tili o'qimang, miya dam olsin", yoki "faqat o'zingiz yoqtirgan 1 ta podcast eshiting").
      
      Post qisqa, o'qishli va eng muhimi - sun'iylikdan xoli, 100% tirik inson yozgandek jaranglashi shart.`,
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
 * Generate Magic 3 collocations
 */
export async function generateMagic3() {
  const client = getAI();
  if (!client) return null;

  try {
    const topics = ['Environment', 'Technology', 'Education', 'Health', 'Economy', 'Crime', 'Society', 'Work', 'Space', 'Media'];
    const topic = topics[Math.floor(Math.random() * topics.length)];

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `IELTS IELTS dagi "${topic}" mavzusi uchun 3 ta juda kuchli, doim birga keladigan so'z birikmalari (Collocations) - "Magic 3" postini yarating.
        
        Quyidagicha tuzilsin:
        - Sarlavha: 🪄 Magic 3: [Mavzu nomi o'zbekcha]
        - 1. [Inglizcha birikma] - [O'zbekcha tarjimasi]
          Misol: [1 ta qisqa inglizcha gap]
        - 2...
        - 3...
        
        Hech qanday qo'shimcha so'z, salomlashish yoki tushuntirish kerak emas. Faqat aniq va londa ro'yxat!`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.85,
        maxOutputTokens: 2048,
      },
    });
    return response.text;
  } catch (error) {
    console.error('❌ Gemini magic 3 generation failed:', error.message);
    return null;
  }
}

/**
 * Generate 10-second Micro Reading
 */
export async function generateMicroReading() {
  const client = getAI();
  if (!client) return null;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `IELTS Reading uchun "10 soniyalik test" (Micro Reading) tuzing. 

        MUHIM QOIDALAR:
        1. Matn darajasi (Level): O'rtacha (Intermediate/Upper-Intermediate). Juda qiyin yoki kamyob akademik so'zlarni ishlatmang. Matn hajmi 3-4 gapdan iborat bo'lsin.
        2. Paraphrasing (Eng muhim!): Savollardagi va javob variantlaridagi so'zlar matndagi so'zlarni aslo aynan takrorlamasin! Ma'nodosh so'zlar (synonyms) va iboralar bilan "paraphrase" qiling.
        3. 3 ta har xil turdagi test tuzing:
           - 1-savol: True/False/Not Given
           - 2-savol: Multiple Choice (Asosiy g'oya yoki ma'lum bir detalni topish)
           - 3-savol: Vocabulary/Paraphrase (Matndagi bitta so'z yoki iboraning to'g'ri sinonimini topish)
        
        QATTIQ FORMAT (faqat JSON qaytar, boshqa hech narsa yo'q):
        {
          "text": "⏱ <b>Micro Reading</b>\\n👇 Matnni o'qing va testlarni ishlang:\\n\\n[Bu yerga 3-4 gapdan iborat matn yozing]",
          "quizzes": [
            {
              "question": "1. True/False/Not Given savoli",
              "options": ["True", "False", "Not Given"],
              "correct_index": 0,
              "explanation": "Nima uchun to'g'ri (1-2 gap, o'zbekcha)"
            },
            {
              "question": "2. Multiple Choice savoli",
              "options": ["A varianti", "B varianti", "C varianti", "D varianti"],
              "correct_index": 2,
              "explanation": "Nima uchun to'g'ri (1-2 gap, o'zbekcha)"
            },
            {
              "question": "3. Vocabulary/Paraphrasing savoli",
              "options": ["A varianti", "B varianti", "C varianti", "D varianti"],
              "correct_index": 1,
              "explanation": "Nima uchun to'g'ri (1-2 gap, o'zbekcha)"
            }
          ]
        }`,
      config: {
        systemInstruction: 'Faqat valid JSON qaytar. Boshqa hech qanday matn yoki markdown yozma.',
        temperature: 0.85,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    });
    console.log('🤖 Finish Reason:', response.candidates?.[0]?.finishReason);
    
    let testData;
    try {
      testData = JSON.parse(response.text);
    } catch (parseError) {
      console.error('❌ JSON parse error. Raw response text was:', response.text);
      throw parseError;
    }
    
    if (!testData.text || !Array.isArray(testData.quizzes) || testData.quizzes.length !== 3) {
      console.error('❌ Invalid micro reading structure from Gemini');
      return null;
    }
    
    return testData;
  } catch (error) {
    console.error('❌ Gemini micro reading generation failed:', error.message);
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
      
      Sun'iy shablonlardan (masalan, yodlangan ro'yxatlardan) foydalanmang. Jonli, o'qishli va tabiiy matn yarating.
      DIQQAT: Matnni va gapni hech qachon chala uzib qo'ymang! Barcha qismlar to'liq yozib tugatilishi shart.`,
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
    const promptText = `Siz tajribali, ammo juda zamonaviy va samimiy IELTS o'qituvchisisiz. 2025 yoki 2026 yilda (Global yoki O'zbekistonda) haqiqiy imtihonda tushgan IELTS Writing Task 2 savolini o'ylab toping.
      
      Shu savol asosida Telegram kanali uchun post yozing. 
      
      POST JUDA TABIIY VA JONLI BO'LISHI SHART! Xuddi do'stingizga ovozli xabar yuborayotgandek yoki darsda o'quvchilarga qiziqarli qilib gapirib berayotgandek yozing. 
      Robotlarga xos bo'lgan qoliplardan (masalan: "Afzalliklari: 1, 2, 3", "Ishlatiladigan so'zlar:") U-MU-MAN foydalanmang! 
      
      Post quyidagicha silliq oqib kelishi kerak:
      1. Savolning o'zi (inglizcha) va uning qisqa, sodda o'zbekcha tarjimasi (tarjima so'zma-so'z bo'lmasin, o'zbekchasiga tabiiy jaranglasin).
      2. Bu essayga qanday g'oyalar bilan yozish mumkinligini shunchaki 2-3 ta gap bilan tushuntirib bering (hech qanday ro'yxat yoki nuqtachalar qo'ymang, matn ko'rinishida yozing).
      3. Shu fikringiz ichida 3 ta kuchli (Band 8+) inglizcha so'zni tabiiy ravishda qistirib o'tib keting va qavs ichida ma'nosini yozing. Alohida so'zlar ro'yxati qilmang! So'zlarga (verb), (noun) deb yozish shart emas.
      
      Misol uchun stili shunday bo'lsin: "Bunga nima deb yozishimiz mumkin? Bir tomondan... (inglizcha zo'r so'z - ma'nosi) deyishimiz mumkin. Ikkinchi tomondan esa..."
      
      DIQQAT: Hech qanday ro'yxatlar (bullet points), raqamlangan qatorlar qilmang. Matnni va gapni hech qachon chala uzib qo'ymang! Barcha qismlar to'liq va yakunlangan bo'lishi shart.`;

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
