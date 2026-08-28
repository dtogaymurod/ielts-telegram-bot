import { generateSpeakingPDF } from '../src/speaking-pdf-generator.js';
import path from 'path';

const sampleData = {
  lessonNumber: 'LESSON 1',
  title: 'PRE-CLASS PREPARATION MASTER GUIDE',
  theme: 'People, Friendship, Family & Inspiration',
  overview: 'This master study guide provides comprehensive preparation for EVERY SINGLE QUESTION in Lesson 1. It covers 8 Part 1 questions, 4 Part 2 Cue Cards with 2-minute model monologues, and 18 Part 3 questions with complete AREA breakdowns. Study this guide before class to ensure high fluency and accurate delivery during classroom drills.',
  vocabularies: [
    { word: 'Kindred spirit (idiom)', meaning: 'Qalb yaqini, hamfikr inson', example: 'From the moment we met in school, I knew he was a kindred spirit.' },
    { word: 'Through thick and thin', meaning: 'Barcha qiyinchilik va shodliklarda', example: 'A true childhood friend stands by you through thick and thin.' },
    { word: 'Pillar of support', meaning: "Suyanchiq, tog'dek tayanch", example: 'My elder brother has always been an unwavering pillar of support.' },
    { word: 'Leave an indelible mark', meaning: "O'chmas iz qoldirmoq", example: 'My high school mentor left an indelible mark on my personality.' },
    { word: 'See eye to eye with sb', meaning: 'Fikri bir joydan chiqmoq', example: 'Although we occasionally differ, for the most part we see eye to eye.' },
    { word: 'Role model / Mentor', meaning: "O'rnak bo'ladigan shaxs / ustoz", example: 'She is an exemplary role model who mentors young entrepreneurs.' },
    { word: 'Infectious charisma', meaning: 'Barchani maftun etuvchi joziba', example: 'His infectious charisma and eloquence inspire millions globally.' },
    { word: 'Altruistic nature', meaning: "Beg'araz yordam berish", example: 'He is widely admired for his altruistic nature and willingness to help.' },
    { word: 'Household name', meaning: 'Hammaga mashhur shaxs', example: 'Through groundbreaking innovations, he became a household name.' },
    { word: 'Formative years', meaning: 'Shaxsiyat shakllanadigan yillar', example: "Teachers play a crucial role during a student's formative years." },
    { word: 'Drift apart (phrasal verb)', meaning: 'Asta-sekin uzoqlashib ketmoq', example: 'As careers diverge, childhood friends often naturally drift apart.' },
    { word: 'Look up to sb', meaning: 'Havas qilmoq, hurmat qilmoq', example: 'I have always looked up to my uncle because of his work ethic.' },
    { word: 'Generational gap', meaning: "Avlodlar o'rtasidagi tafovut", example: 'A widening generational gap makes communication challenging.' },
    { word: 'Emulate virtues', meaning: 'Ezgu fazilatlarga taqlid qilish', example: 'Young people strive to emulate the virtues of inspiring leaders.' }
  ],
  grammarFormulas: [
    {
      title: 'A. Defining & Non-defining Relative Clauses',
      subtitle: 'Formula & Band 8.5+ Transformation',
      content: "<strong>Standard:</strong> 'My teacher was Mr. Smith. He helped me.'<br><strong>✨ Band 8.5+:</strong> <em>'My English instructor, whose boundless dedication transformed my perspective, was instrumental in shaping my academic trajectory.'</em>"
    },
    {
      title: "B. 'Used to' vs 'Would' for Childhood Memories",
      subtitle: 'Storytelling Habitual Actions',
      content: "<strong>Rule:</strong> Use 'used to' for past states and 'would' for repeated vivid actions:<br><em>'We used to live in the same neighborhood. Every afternoon after school, we would cycle down to the park and share our ambitions.'</em>"
    },
    {
      title: 'C. Cleft Sentences for High Emphasis',
      subtitle: 'Cleft Formula',
      content: "<em>'What strikes me most about his personality is his humility despite immense fame.'</em><br><em>'It was her words of encouragement that ultimately persuaded him to succeed.'</em>"
    },
    {
      title: 'D. Mixed Conditionals & Inversion',
      subtitle: 'Inversion Formula',
      content: "<em>'Had it not been for my mentor\'s timely guidance, I would not be pursuing this professional career today.'</em>"
    }
  ],
  part1TopicTitle: 'Topic 1: Hometown (Always in use) & Teachers (May-Dec 2026)',
  part1Questions: [
    {
      question: 'Where is your hometown?',
      answer: 'I hail from Samarkand, a historically renowned city situated in the southeastern region of Uzbekistan. It is celebrated globally for its magnificent Silk Road architecture and vibrant cultural heritage.'
    },
    {
      question: "What's your hometown well-known for?",
      answer: 'My hometown is predominantly famous for its awe-inspiring monuments such as Registan Square, which attract tourists worldwide. Beyond its breathtaking landmarks, it is also revered for its warm hospitality and authentic culinary traditions.'
    },
    {
      question: 'Did you have a favorite teacher at school?',
      answer: 'Indeed, I was fortunate to have an exceptional literature teacher named Mrs. Elena. What made her stand out was her innovative teaching methodology, which brought classical poetry vividly to life rather than relying on monotonous memorization.'
    },
    {
      question: 'How did this teacher help you?',
      answer: 'She was instrumental in building my self-confidence. Whenever I struggled with complex essays, she offered personalized guidance, patiently critiquing my drafts and instilling in me a profound passion for creative writing.'
    }
  ],
  part2CueCards: [
    {
      topic: 'Childhood Friend',
      prompt: 'Describe a friend from your childhood.',
      bullets: [
        'who this person is',
        'how you met each other',
        'what you did together',
        'and explain why you liked him or her.'
      ],
      monologue: "I would like to talk about a close childhood companion of mine named Anvar, with whom I shared my formative years. We first crossed paths back in primary school when we were roughly seven years old. I vividly remember feeling rather anxious on the first day of grade one, and by sheer coincidence, we were seated next to each other. We quickly broke the ice by sharing our sketchbooks, and from that day forward, an inseparable friendship blossomed.<br><br>Growing up in the same neighborhood, we spent virtually every afternoon together. After finishing our homework, we would cycle down to the local park, play impromptu football matches, and build imaginative treehouses. What made our camaraderie truly special was our shared passion for science fiction books; we would spend hours discussing space exploration and dreaming about the future.<br><br>The reason I have always held him in such high esteem is his unwavering integrity and altruistic nature. He was never the kind of friend who would abandon you during hardships; rather, he stood by me through thick and thin. Even when we occasionally had petty squabbles, we would resolve them swiftly without harboring any resentment. He remains a true kindred spirit in my life."
    }
  ],
  part3TopicTitle: 'Topic A: Friendship Dynamics & Influences (May-Dec 2026)',
  part3Questions: [
    {
      question: 'Is it easy to make new friends today?',
      a: 'It is a paradox: forming superficial acquaintances has become easier, whereas forging genuine friendships has grown harder.',
      r: 'Social media connects thousands instantly, but digital interactions lack vulnerability.',
      e: 'A teen may have 1,000 online followers yet struggle to find one confidant during a crisis.',
      alt: 'In the past, shared physical spaces nurtured slower, far more resilient bonds.'
    },
    {
      question: 'Do childhood friendships usually last forever?',
      a: 'In most instances, childhood friendships tend to diminish over time.',
      r: 'Transitioning into adulthood causes career paths, priorities, and geography to diverge.',
      e: 'Moving to a distant city for higher education often leads friends to drift apart.',
      alt: 'Nonetheless, deliberate communication and shared core values can keep bonds alive.'
    },
    {
      question: 'Is it better to have many friends or just a few close ones?',
      a: 'Quality outweighs quantity; a handful of intimate confidants is far superior.',
      r: 'Deep relationships provide psychological safety and trust that broad networks cannot.',
      e: 'During crises, it is close friends who offer practical help, not casual followers.',
      alt: 'However, a broader peripheral network remains valuable for professional networking.'
    }
  ]
};

const outputPdf = path.resolve('./IELTS_Speaking_Master_Guide_Sample.pdf');
console.log('Generating sample PDF...');
await generateSpeakingPDF(sampleData, outputPdf);
console.log('Sample PDF successfully generated at:', outputPdf);
