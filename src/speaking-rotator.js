/**
 * Speaking Part Rotator and Guide Publisher
 * Rotates daily: Part 1 -> Part 2 -> Part 3
 * Dynamically processes all topics from Speaking/ markdown databases using Gemini AI.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSpeakingPartPDF } from './speaking-pdf-generator.js';
import { parsePart1Topics, parsePart2Topics, parsePart3Topics } from './speaking-parser.js';
import { getAI, generateWithFallback } from './gemini.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '..', 'content', 'speaking_state.json');

export function getSpeakingState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Error reading speaking state:', e.message);
  }
  return { currentPart: 1, part1Index: 0, part2Index: 0, part3Index: 0 };
}

export function saveSpeakingState(state) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving speaking state:', e.message);
  }
}

/**
 * Generate Part 1 Study Guide Data using AI
 */
async function generatePart1GuideData(topicObj) {
  const client = getAI();
  if (client) {
    try {
      const prompt = `Siz professional IELTS Speaking examiner va murabbiyisiz.
Quyidagi IELTS Speaking Part 1 mavzusi va savollari asosida 2 sahifalik Masterclass Study Guide uchun ma'lumot tayyorlang:
Mavzu: ${topicObj.title}
Savollar:
${topicObj.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

TALABLAR:
1. vocabularies: Mavzuga oid 6 ta Band 8.5+ so'z/kollokatsiya/idiom (o'zbekcha aniq tarjimasi va IELTS misoli bilan).
2. grammarFormulas: 2 ta kuchli grammatik formula (masalan: Relative Clauses va Cleft sentences yoki Inversion).
3. questions: Berilgan har bir savolga Band 8.5+ darajadagi tabiiy, ravon namunaviy javob va o'zbekcha 1 jumlalik "keyPoint" maslahati.

FAQAT VALID JSON qaytaring (hech qanday markdown yoki boshqa matnsiz):
{
  "topicTitle": "${topicObj.title.toUpperCase()}",
  "subTheme": "May–Dec 2026 Latest Question Pool",
  "vocabularies": [
    { "word": "word / phrase", "meaning": "o'zbekcha ma'nosi", "example": "full IELTS context example" }
  ],
  "grammarFormulas": [
    { "title": "A. Grammar Rule Name", "subtitle": "Formula & Band 8.5+ Transformation", "content": "<strong>Standard:</strong> '...'<br><strong>✨ Band 8.5+:</strong> <em>'...'</em>" },
    { "title": "B. Emphasis Formula Name", "subtitle": "Emphasis Structure", "content": "<em>'...'</em>" }
  ],
  "questions": [
    { "question": "Question text", "answer": "Band 8.5+ model answer", "keyPoint": "Key takeaway in Uzbek" }
  ]
}`;

      const response = await generateWithFallback(client, {
        contents: prompt,
        config: { temperature: 0.8, responseMimeType: 'application/json' }
      });

      const parsed = JSON.parse(response.text);
      if (parsed.topicTitle && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        return parsed;
      }
    } catch (err) {
      console.error('⚠️ AI Part 1 guide generation failed, using structured fallback:', err.message);
    }
  }

  // Fallback structure
  return {
    topicTitle: topicObj.title.toUpperCase(),
    subTheme: 'May–Dec 2026 Latest Question Pool',
    vocabularies: [
      { word: 'Pivotal role', meaning: 'Hal qiluvchi ahamiyat', example: 'This topic plays a pivotal role in daily routines and social interactions.' },
      { word: 'Aesthetic appeal', meaning: 'Estetik joziba', example: 'I deeply appreciate its unique aesthetic appeal and calming ambiance.' },
      { word: 'Formative experience', meaning: 'Shaxsiyatni shakllantiruvchi tajriba', example: 'It was truly a formative experience that reshaped my daily perspective.' },
      { word: 'Reap substantial benefits', meaning: 'Katta foyda ko\'rmoq', example: 'Engaging in this habit allows individuals to reap substantial long-term benefits.' }
    ],
    grammarFormulas: [
      {
        title: 'A. Non-defining Relative Clauses (Adding Detail)',
        subtitle: 'Formula & Band 8.5+ Transformation',
        content: "<strong>Standard:</strong> 'I really enjoy this activity. It helps me relax.'<br><strong>✨ Band 8.5+:</strong> <em>'This pastime, which has been an integral part of my lifestyle for years, serves as an incredible stress reliever.'</em>"
      },
      {
        title: 'B. Cleft Sentences (High Emphasis)',
        subtitle: 'Emphasis Structure',
        content: "<em>'What captivates me most about this experience is how it broadens my worldview.'</em>"
      }
    ],
    questions: topicObj.questions.map(q => ({
      question: q,
      answer: `Without a doubt, this is an area I find remarkably intriguing. In my daily life, I make a deliberate effort to engage with it because it fosters personal growth and provides a wonderful mental break.`,
      keyPoint: "Boshlanishida 'Without a doubt' yoki 'To be completely honest' kabi tabiiy kirish so'zlaridan foydalaning."
    }))
  };
}

/**
 * Generate Part 2 Study Guide Data using AI
 */
async function generatePart2GuideData(topicObj) {
  const client = getAI();
  if (client) {
    try {
      const prompt = `Siz professional IELTS Speaking examiner va murabbiyisiz.
Quyidagi IELTS Speaking Part 2 Cue Card mavzusi asosida 2 sahifalik Masterclass Study Guide uchun ma'lumot tayyorlang:
Mavzu: ${topicObj.title}
Cue Card Prompt: ${topicObj.prompt}
You should say:
${topicObj.bullets.map(b => `• ${b}`).join('\n')}

TALABLAR:
1. noteStrategy: 1 daqiqalik eslatma yozish strategiyasi (HTML formatda Who/What, Past Habitual, Specific Anecdote, Reflection).
2. vocabularies: 5-6 ta hikoyani jonlantiruvchi Band 8.5+ iboralar (o'zbekcha tarjimasi va misoli bilan).
3. monologue: 2 daqiqalik (taxminan 210-240 ta so'z), 3 ta mantiqiy paragrafga bo'lingan, 'used to/would', relative clauses va ravon bog'lovchilar bilan to'liq model monolog. Paragraflar orasiga <br><br> qo'ying.
4. followUps: Examiner'ning 2 ta qo'shimcha savoli va Band 8.5+ lo'nda javoblari.

FAQAT VALID JSON qaytaring:
{
  "topicTitle": "CUE CARD: ${topicObj.title.toUpperCase()}",
  "cueCardTitle": "${topicObj.prompt}",
  "prompt": "You should say:",
  "bullets": ${JSON.stringify(topicObj.bullets)},
  "noteStrategy": "• <strong>Who / What:</strong> ...<br>• <strong>Context & Background:</strong> ...<br>• <strong>Key Anecdote:</strong> ...<br>• <strong>Personal Reflection:</strong> ...",
  "vocabularies": [
    { "word": "idiom / phrase", "meaning": "o'zbekcha ma'nosi", "example": "context in monologue" }
  ],
  "monologue": "I would like to talk about...<br><br>Paragraph 2...<br><br>Paragraph 3...",
  "followUps": [
    { "question": "Follow-up question 1", "answer": "Band 8.5+ quick answer" },
    { "question": "Follow-up question 2", "answer": "Band 8.5+ quick answer" }
  ]
}`;

      const response = await generateWithFallback(client, {
        contents: prompt,
        config: { temperature: 0.85, responseMimeType: 'application/json' }
      });

      const parsed = JSON.parse(response.text);
      if (parsed.topicTitle && parsed.monologue) {
        return parsed;
      }
    } catch (err) {
      console.error('⚠️ AI Part 2 guide generation failed, using structured fallback:', err.message);
    }
  }

  // Fallback structure
  return {
    topicTitle: `CUE CARD: ${topicObj.title.toUpperCase()}`,
    cueCardTitle: topicObj.prompt,
    prompt: 'You should say:',
    bullets: topicObj.bullets,
    noteStrategy: '• <strong>Core Focus:</strong> Aniq obyekt/shaxsni darhol tanlang.<br>• <strong>Chronological Build-up:</strong> Voqea qachon va qanday boshlanganini bayon qiling.<br>• <strong>Vivid Anecdote:</strong> 1 ta eng yorqin lahzani tasvirlang.<br>• <strong>Emotional Reflection:</strong> Bu narsa sizda qanday taassurot qoldirganini xulosa qiling.',
    vocabularies: [
      { word: 'Leave an indelible mark', meaning: 'O\'chmas iz qoldirmoq', example: 'This particular experience left an indelible mark on my overall outlook.' },
      { word: 'Vividly recall', meaning: 'Yorqin eslay olmoq', example: 'I vividly recall the overwhelming excitement I felt at that exact moment.' },
      { word: 'Integral part of', meaning: 'Ajralmas qismi', example: 'It swiftly evolved into an integral part of my personal growth.' },
      { word: 'Through thick and thin', meaning: 'Barcha qiyinchiliklarda', example: 'It taught me the importance of resilience through thick and thin.' }
    ],
    monologue: `I would like to talk about ${topicObj.prompt.toLowerCase()}, which has been one of the most memorable experiences in my life. The entire event took place a couple of years ago during a particularly transformative period.<br><br>What made this occurrence exceptionally distinctive was the sheer unpredictability of the circumstances. Initially, I felt somewhat apprehensive, but as things unfolded, I became thoroughly immersed in the moment. I distinctly remember paying close attention to every intricate detail, which truly brought the whole atmosphere to life.<br><br>Reflecting back on it today, the primary reason this stands out so profoundly is the valuable lesson it imparted. It not only broadened my perspective but also reinforced my appreciation for meaningful moments. It remains an unforgettable milestone that I cherish deeply.`,
    followUps: [
      { question: 'Do you often think about this today?', answer: 'Yes, whenever I encounter similar situations, the memories naturally resurface and provide wonderful inspiration.' },
      { question: 'Would you recommend a similar experience to others?', answer: 'Unquestionably. It offers an invaluable opportunity for personal discovery and creating lasting memories.' }
    ]
  };
}

/**
 * Generate Part 3 Study Guide Data using AI
 */
async function generatePart3GuideData(topicObj) {
  const client = getAI();
  if (client) {
    try {
      const prompt = `Siz professional IELTS Speaking examiner va murabbiyisiz.
Quyidagi IELTS Speaking Part 3 chuqur savollari asosida 2 sahifalik Masterclass Study Guide uchun ma'lumot tayyorlang:
Mavzu: ${topicObj.title}
Savollar:
${topicObj.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

TALABLAR:
1. vocabularies: Abstrakt va ijtimoiy tahlil uchun 4-5 ta Band 8.5+ akademik iboralar (o'zbekcha tarjimasi va misoli bilan).
2. questions: 3-4 ta asosiy savolga AREA metodi (A - Answer, R - Reason, E - Example, Alt - Alternative) bo'yicha Band 8.5+ chuqur, tahliliy javoblar.

FAQAT VALID JSON qaytaring:
{
  "topicTitle": "PART 3: ${topicObj.title.toUpperCase()}",
  "subTheme": "May–Dec 2026 Deep Discussion Questions",
  "vocabularies": [
    { "word": "academic collocation", "meaning": "o'zbekcha ma'nosi", "example": "Part 3 discussion context" }
  ],
  "questions": [
    {
      "question": "Question text",
      "a": "Direct, sophisticated thesis answer",
      "r": "Logical underlying reason",
      "e": "Concrete societal or realistic example",
      "alt": "Counter-perspective or conditional alternative"
    }
  ]
}`;

      const response = await generateWithFallback(client, {
        contents: prompt,
        config: { temperature: 0.8, responseMimeType: 'application/json' }
      });

      const parsed = JSON.parse(response.text);
      if (parsed.topicTitle && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        return parsed;
      }
    } catch (err) {
      console.error('⚠️ AI Part 3 guide generation failed, using structured fallback:', err.message);
    }
  }

  // Fallback structure
  return {
    topicTitle: `PART 3: ${topicObj.title.toUpperCase()}`,
    subTheme: 'May–Dec 2026 Deep Discussion Questions',
    vocabularies: [
      { word: 'Profound socio-economic impact', meaning: 'Chuqur ijtimoiy-iqtisodiy ta\'sir', example: 'This phenomenon exerts a profound socio-economic impact on modern urban communities.' },
      { word: 'Foster sustainable growth', meaning: 'Barqaror o\'sishni rag\'batlantirmoq', example: 'Governments must implement targeted policies to foster sustainable growth.' },
      { word: 'Paradoxical outcome', meaning: 'Kutilmagan, qarama-qarshi natija', example: 'While technological advances increase efficiency, they occasionally yield paradoxical outcomes.' },
      { word: 'Exacerbate societal disparities', meaning: 'Ijtimoiy tafovutlarni kuchaytirmoq', example: 'Unchecked commercialization risks exacerbating existing societal disparities.' }
    ],
    questions: topicObj.questions.slice(0, 3).map(q => ({
      question: q,
      a: 'It presents a complex dynamic where positive modernization intersects with traditional lifestyle values.',
      r: 'As economic globalization accelerates, societal expectations evolve rapidly toward efficiency and accessibility.',
      e: 'A prime example is how digital platforms have completely restructured consumer engagement across major cities.',
      alt: 'Conversely, in more rural regions, conventional practices remain firmly anchored despite digital proliferation.'
    }))
  };
}

/**
 * Main function: Generate daily Speaking publication PDF & Caption
 */
export async function generateDailySpeakingPublication() {
  const state = getSpeakingState();
  const partNumber = state.currentPart || 1;

  console.log(`🎙 Preparing Speaking Master Guide for Part ${partNumber}...`);

  const p1Pool = parsePart1Topics();
  const p2Pool = parsePart2Topics();
  const p3Pool = parsePart3Topics();

  let topicData = null;
  let cleanName = '';

  if (partNumber === 1) {
    const p1Idx = (state.part1Index || 0) % (p1Pool.length || 1);
    const selected = p1Pool[p1Idx] || { title: 'Teachers', questions: ['Do you have a favorite teacher?'] };
    console.log(`📌 Selected Part 1 Topic [${p1Idx + 1}/${p1Pool.length}]: "${selected.title}"`);
    topicData = await generatePart1GuideData(selected);
    cleanName = selected.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  } else if (partNumber === 2) {
    const p2Idx = (state.part2Index || 0) % (p2Pool.length || 1);
    const selected = p2Pool[p2Idx] || { title: 'Describe a new place', prompt: 'Describe a new place', bullets: ['where it was'] };
    console.log(`📌 Selected Part 2 Cue Card [${p2Idx + 1}/${p2Pool.length}]: "${selected.title}"`);
    topicData = await generatePart2GuideData(selected);
    cleanName = selected.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  } else {
    const p3Idx = (state.part3Index || 0) % (p3Pool.length || 1);
    const selected = p3Pool[p3Idx] || { title: 'Tourism', questions: ['What places do tourists visit?'] };
    console.log(`📌 Selected Part 3 Topic [${p3Idx + 1}/${p3Pool.length}]: "${selected.title}"`);
    topicData = await generatePart3GuideData(selected);
    cleanName = selected.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  }

  const fileName = `IELTS_Speaking_Part_${partNumber}_${cleanName}.pdf`;
  const pdfPath = path.join(__dirname, '..', fileName);

  console.log(`📄 Generating 2-page PDF: ${fileName}...`);
  await generateSpeakingPartPDF(partNumber, topicData, pdfPath);

  // Rotate state for next run
  const nextPart = (partNumber % 3) + 1;
  const nextState = {
    ...state,
    currentPart: nextPart,
    part1Index: partNumber === 1 ? (state.part1Index || 0) + 1 : (state.part1Index || 0),
    part2Index: partNumber === 2 ? (state.part2Index || 0) + 1 : (state.part2Index || 0),
    part3Index: partNumber === 3 ? (state.part3Index || 0) + 1 : (state.part3Index || 0),
  };
  saveSpeakingState(nextState);

  // Build Telegram Caption
  let caption = '';
  if (partNumber === 1) {
    const qList = (topicData.questions || [])
      .map((q, i) => `${i + 1}. <i>${q.question}</i>`)
      .join('\n');

    caption = `🎙 <b>IELTS Speaking Part 1 Master Guide</b> 🔥\n\n📌 <b>Mavzu:</b> <i>${topicData.topicTitle}</i> (May–Dec 2026)\n\n❓ <b>Bugungi imtihon savollari:</b>\n${qList}\n\n💡 <b>Tayyorgarlik va tavsiyalar:</b>\nUshbu savollarga <b>Band 8.5+ namunaviy javoblar</b>, yuqori ball beruvchi <b>Top lug'at va kollokatsiyalar</b> hamda <b>Grammatika formulalari</b> bilan tanishish uchun biriktirilgan PDF qo'llanmani oching! 📑👇\n\n<i>Faylni yuklab oling va ovoz chiqarib mashq qiling!</i> ⏱✅`;
  } else if (partNumber === 2) {
    const bulletList = (topicData.bullets || [])
      .map(b => `• <i>${b}</i>`)
      .join('\n');

    caption = `🎙 <b>IELTS Speaking Part 2 Cue Card Guide</b> 🎯\n\n📌 <b>Mavzu:</b> <i>${topicData.cueCardTitle}</i> (May–Dec 2026)\n\n❓ <b>Cue Card topshirig'i:</b>\n<b>You should say:</b>\n${bulletList}\n\n💡 <b>Tayyorgarlik va tavsiyalar:</b>\nUshbu mavzuda 2 daqiqa to'xtovsiz gapirish uchun <b>1-Minute Note-Taking rejasi</b>, <b>Storytelling iboralari</b> va <b>to'liq 2 daqiqalik Band 8.5+ model monolog</b>ni o'rganish uchun biriktirilgan PDF faylni oching! 📑👇\n\n<i>Faylni yuklab oling va 2 daqiqalik taymer qo'yib mashq qiling!</i> ⏱🎙`;
  } else {
    const qList = (topicData.questions || [])
      .map((q, i) => `${i + 1}. <i>${q.question}</i>`)
      .join('\n');

    caption = `🎙 <b>IELTS Speaking Part 3 Discussion Guide</b> 🧠\n\n📌 <b>Mavzu:</b> <i>${topicData.topicTitle}</i> (May–Dec 2026)\n\n❓ <b>Bugungi chuqur muhokama savollari:</b>\n${qList}\n\n💡 <b>Tayyorgarlik va tavsiyalar:</b>\nUshbu murakkab savollarga <b>AREA metodi</b> (Answer, Reason, Example, Alternative) asosidagi Band 8.5+ tahliliy javoblar va <b>akademik frazalar</b> bilan tanishish uchun biriktirilgan PDF qo'llanmani oching! 📑👇\n\n<i>Faylni oching va fikringizni chuqur asoslashni mashq qiling!</i> 💡✅`;
  }

  return {
    pdfPath,
    fileName,
    caption,
    partNumber
  };
}
