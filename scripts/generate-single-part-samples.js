import { generateSpeakingPartPDF } from '../src/speaking-pdf-generator.js';
import path from 'path';

// 1. PART 1 SAMPLE DATA
const part1Data = {
  topicTitle: 'TOPIC: TEACHERS & MENTORS',
  subTheme: 'May–Dec 2026 Latest Question Pool (Topic 5)',
  vocabularies: [
    { word: 'Formative years', meaning: 'Shaxsiyat shakllanadigan yillar', example: "Teachers play a pivotal role during a student's formative years." },
    { word: 'Instrumental in', meaning: 'Katta ahamiyatga ega bo\'lmoq', example: 'She was instrumental in building my self-confidence and passion for literature.' },
    { word: 'Monotonous memorization', meaning: 'Bir xil yodlab olish', example: 'Her interactive approach brought poetry to life rather than relying on monotonous memorization.' },
    { word: 'Nurture potential', meaning: 'Salohiyatni kashf etib o\'stirmoq', example: 'Great educators have the unique ability to identify and nurture raw potential.' },
    { word: 'Role model', meaning: 'O\'rnak bo\'ladigan shaxs', example: 'I have always regarded my high school mentor as an exemplary role model.' },
    { word: 'Leave an indelible mark', meaning: 'O\'chmas iz qoldirmoq', example: 'Her encouraging words left an indelible mark on my academic trajectory.' }
  ],
  grammarFormulas: [
    {
      title: 'A. Non-defining Relative Clauses (Adding Sophisticated Detail)',
      subtitle: 'Formula & Band 8.5+ Transformation',
      content: "<strong>Standard:</strong> 'My teacher was Mrs. Elena. She helped me a lot.'<br><strong>✨ Band 8.5+:</strong> <em>'My literature teacher, whose innovative methodology transformed my perspective, was instrumental in shaping my career.'</em>"
    },
    {
      title: 'B. Cleft Sentences (High Emphasis)',
      subtitle: 'Emphasis Structure',
      content: "<em>'What made her stand out from others was her boundless patience when critiquing our essays.'</em>"
    }
  ],
  questions: [
    {
      question: 'Do you have a favorite teacher from your school days?',
      answer: 'Indeed, I was fortunate to have an exceptional literature teacher named Mrs. Elena. What made her stand out was her innovative teaching methodology, which brought classical literature vividly to life rather than relying on rote learning.',
      keyPoint: "Boshlashda 'Indeed' yoki 'Without a doubt' kabi tabiiy introductory so'zlardan foydalaning."
    },
    {
      question: 'How did this teacher help or inspire you?',
      answer: 'She was truly instrumental in developing my analytical mindset. Whenever I struggled with complex essays, she offered personalized guidance, patiently critiquing my drafts and instilling in me a profound passion for creative writing.',
      keyPoint: "'Help' o'rniga 'instrumental in', 'instilling a passion' kabi kuchli kollokatsiyalarni ishlating."
    },
    {
      question: 'Are you still in touch with any of your former teachers?',
      answer: 'Yes, we maintain occasional contact. Although geographical distance makes frequent meetups challenging, I always make a point of sending her heartfelt greetings on Teachers\' Day to express my ongoing gratitude.',
      keyPoint: "'Keep in touch' o'rniga 'maintain occasional contact' deyish ravonlikni oshiradi."
    },
    {
      question: 'Would you ever consider becoming a teacher in the future?',
      answer: 'While I regard teaching as an immensely noble and fulfilling profession, I do not envision it as my primary career path because it demands extraordinary emotional resilience, though I would love to conduct guest seminars occasionally.',
      keyPoint: "'While I regard... I do not envision...' grammatik balansi yuqori ball keltiradi."
    }
  ]
};

// 2. PART 2 SAMPLE DATA
const part2Data = {
  topicTitle: 'CUE CARD: CHILDHOOD FRIEND',
  cueCardTitle: 'Describe a friend from your childhood',
  prompt: 'You should say:',
  bullets: [
    'who this person is',
    'how and when you met each other',
    'what activities you enjoyed doing together',
    'and explain why you liked him or her so much.'
  ],
  vocabularies: [
    { word: 'Kindred spirit (idiom)', meaning: 'Qalb yaqini, hamfikr inson', example: 'From our very first conversation, I knew he was a true kindred spirit.' },
    { word: 'Through thick and thin', meaning: 'Barcha qiyinchilik va shodliklarda', example: 'He is the kind of loyal friend who stands by you through thick and thin.' },
    { word: 'Inseparable bond', meaning: 'Ajralmas mustahkam do\'stlik', example: 'Growing up in the same neighborhood, we formed an almost inseparable bond.' },
    { word: 'Break the ice', meaning: 'Tanishuvdagi noqulaylikni yo\'qotish', example: 'We broke the ice on the first day of primary school by sharing sketchbooks.' },
    { word: 'Drift apart (phrasal verb)', meaning: 'Asta-sekin uzoqlashmoq', example: 'Although distance caused us to drift apart slightly, our core connection remains intact.' }
  ],
  monologue: `I would like to talk about a close childhood companion of mine named Anvar, with whom I shared my most memorable formative years. We first crossed paths back in primary school when we were roughly seven years old. I vividly recall feeling quite apprehensive on the first day of grade one, and by sheer coincidence, we were seated next to each other. We quickly broke the ice by sharing our sketchbooks, and from that day forward, an inseparable friendship blossomed.<br><br>Growing up in the same neighborhood, we spent virtually every single afternoon together. After completing our homework, we would cycle down to the local park, organize impromptu football matches, and build imaginative treehouses. What made our camaraderie truly distinctive was our mutual fascination with astronomy and science fiction books; we would spend hours stargazing and discussing space exploration.<br><br>The primary reason I have always held him in such high esteem is his unwavering integrity and altruistic nature. He was never the kind of fair-weather friend who vanishes during hardships; rather, he stood by me through thick and thin. Even when we occasionally had petty squabbles, we would resolve them swiftly without harboring any resentment. Although our university pursuits have placed us in different cities today, whenever we reconnect, it feels as though no time has passed at all.`,
  followUps: [
    {
      question: 'Do you still keep in contact with this friend today?',
      answer: 'Yes, absolutely. Despite our hectic schedules in different cities, we catch up over video calls every couple of weeks and always make time to meet during national holidays.'
    },
    {
      question: 'Do you think childhood friendships are different from adult friendships?',
      answer: 'Unquestionably. Childhood bonds are formed organically through play without any professional or social pretenses, making them far purer and more resilient.'
    }
  ]
};

// 3. PART 3 SAMPLE DATA
const part3Data = {
  topicTitle: 'PART 3: FRIENDSHIP & SOCIAL DYNAMICS',
  subTheme: 'May–Dec 2026 Deep Discussion Questions',
  vocabularies: [
    { word: 'Superficial acquaintances', meaning: 'Yuzaki tanishlar', example: 'Social media multiplies superficial acquaintances while eroding deep intimacy.' },
    { word: 'Foster authentic connection', meaning: 'Haqiqiy yaqinlikni shakllantirmoq', example: 'Face-to-face interactions foster authentic connections that virtual chats cannot replicate.' },
    { word: 'Emotional vulnerability', meaning: 'Hissiy ochiqlik va samimiylik', example: 'True friendship requires emotional vulnerability and mutual trust.' },
    { word: 'Social alienation', meaning: 'Jamiyatdan begonalashuv', example: 'Excessive reliance on virtual interactions often exacerbates feelings of social alienation.' }
  ],
  questions: [
    {
      question: 'Is it easy to make new friends in the modern digital era?',
      a: 'It presents an intriguing paradox: while forming superficial digital acquaintances has become effortless, forging genuine, enduring friendships is increasingly arduous.',
      r: 'Social media platforms connect thousands instantly, yet digital interactions inherently lack the depth and emotional vulnerability of physical presence.',
      e: 'For instance, a young person may boast thousands of online followers, yet struggle to find a single confidant to turn to during a personal crisis.',
      alt: 'Conversely, for individuals in remote or niche communities, the internet provides an indispensable lifeline to connect with like-minded peers globally.'
    },
    {
      question: 'Do childhood friendships usually survive into adulthood?',
      a: 'In the vast majority of cases, childhood friendships naturally diminish over time.',
      r: 'As individuals transition into adulthood, diverging career ambitions, shifting personal priorities, and geographical relocation inevitably weaken daily contact.',
      e: 'A classic example is moving to another city for higher education, where new environments introduce fresh social circles.',
      alt: 'Nonetheless, with intentional communication and shared foundational values, certain exceptional friendships endure across decades.'
    },
    {
      question: 'Is it preferable to have a broad social circle or a handful of close friends?',
      a: 'Quality unquestionably outweighs quantity; possessing a tight-knit circle of intimate confidants is far more beneficial.',
      r: 'Deep relationships offer genuine psychological safety and unconditional support that superficial networks simply cannot provide.',
      e: 'During severe distress or adversity, it is always close friends who offer tangible assistance rather than casual acquaintances.',
      alt: 'However, maintaining a wider peripheral network remains advantageous for professional networking and exploring diverse viewpoints.'
    }
  ]
};

console.log('Generating Part 1 PDF...');
await generateSpeakingPartPDF(1, part1Data, path.resolve('./IELTS_Speaking_Part_1_Sample.pdf'));

console.log('Generating Part 2 PDF...');
await generateSpeakingPartPDF(2, part2Data, path.resolve('./IELTS_Speaking_Part_2_Sample.pdf'));

console.log('Generating Part 3 PDF...');
await generateSpeakingPartPDF(3, part3Data, path.resolve('./IELTS_Speaking_Part_3_Sample.pdf'));

console.log('All 3 single-part PDFs generated successfully!');
