import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fallbacks = {
  vocabulary: [
    {
      id: "vocab_fb_1",
      text: "📚 <b>IELTS Vocabulary</b>\n━━━━━━━━━━━━━━━━━━━━\nBugun o'rganadigan so'zimiz: <b>Ubiquitous</b> /juːˈbɪkwɪtəs/\n<i>Adjective</i>\n\n🇺🇿 <b>Ma'nosi:</b> Hamma joyda mavjud bo'lgan, keng tarqalgan.\n\n💬 Misol:\n<i>\"Smartphones have become ubiquitous in modern society.\"</i>\n\n💡 <b>Kichik maslahat:</b> Essay yozayotganda \"common\" yoki \"everywhere\" degan so'zlar juda ko'p takrorlanadi. Ularning o'rniga \"ubiquitous\" ishlatsangiz, Lexical Resource ballingiz ancha ko'tariladi!",
      used: false
    },
    {
      id: "vocab_fb_2",
      text: "📚 <b>IELTS Vocabulary</b>\n━━━━━━━━━━━━━━━━━━━━\nBugun o'rganadigan so'zimiz: <b>Mitigate</b> /ˈmɪtɪɡeɪt/\n<i>Verb</i>\n\n🇺🇿 <b>Ma'nosi:</b> Yumshatmoq, yengillashtirmoq, kamaytirmoq (muammo yoki qiyinchilikni).\n\n💬 Misol:\n<i>\"The government must take action to mitigate the effects of climate change.\"</i>\n\n💡 <b>Kichik maslahat:</b> Task 2 'Problem and Solution' essaylarida yechim yozayotganda \"solve\" o'rniga \"mitigate the problem\" (muammoni yumshatish) deb yozish ancha akademik va tabiiyroq eshitiladi.",
      used: false
    }
  ],
  "writing-tips": [
    {
      id: "writing_fb_1",
      text: "✍️ <b>IELTS Writing Tip</b>\n━━━━━━━━━━━━━━━━━━━━\nEssay boshlashda \"Nowadays\" yoki \"In modern society\" degan so'zlar bilan boshlashni to'xtating!\n\nImtihon oluvchilar bu jumlalarni har kuni yuzlab marta o'qishadi va bu sizning yodlab olingan qolipdan foydalanayotganingizni ko'rsatib qo'yadi.\n\nBuning o'rniga, to'g'ridan-to'g'ri mavzuga kirishish ancha samarali:\n❌ <i>\"Nowadays, global warming is a big problem.\"</i>\n✅ <i>\"The accelerating pace of climate change has become a primary concern for governments worldwide.\"</i>",
      used: false
    },
    {
      id: "writing_fb_2",
      text: "✍️ <b>IELTS Writing Tip</b>\n━━━━━━━━━━━━━━━━━━━━\nTask 1 da grafikni tasvirlayotganda har bir raqamni yozib chiqish eng ko'p qilinadigan xatolardan biridir.\n\nMaqsad barcha raqamlarni ro'yxat qilib berish emas, balki asosiy tendensiyalarni (trendlarni) ajratib ko'rsatishdir. Faqat eng yuqori, eng past va keskin o'zgargan nuqtalarnigina raqamlar bilan daldillab bering.\n\nQolgan mayda o'zgarishlarni umumlashtirib yozish qobiliyati Band 7+ olish uchun eng muhim talab hisoblanadi.",
      used: false
    }
  ],
  "speaking-tips": [
    {
      id: "speaking_fb_1",
      text: "🗣 <b>IELTS Speaking Tip</b>\n━━━━━━━━━━━━━━━━━━━━\nSpeaking Part 2 da bir daqiqalik tayyorgarlik vaqtida nimalar haqida o'ylash kerak?\n\nHech qachon to'liq gaplar yozmang, baribir o'qishga vaqt bo'lmaydi! Faqat o'zingiz aytmoqchi bo'lgan 4-5 ta ajoyib, noyob so'zlarni yoki idiotik iboralarni qog'ozga yozib qo'ying.\n\nGapirayotganda ko'zingiz qog'ozga tushganda o'sha chiroyli so'zlar esingizga tushadi va ularni o'z o'rnida ishlata olasiz.",
      used: false
    },
    {
      id: "speaking_fb_2",
      text: "🗣 <b>IELTS Speaking Tip</b>\n━━━━━━━━━━━━━━━━━━━━\nExaminer sizga savol berganda, darhol \"Yes\" yoki \"No\" deb qisqa javob berishdan qoching.\n\nJavobingizni har doim ozgina kengaytiring (kamida 2-3 ta gap). Agar fikr kelmasa, qisqa hikoya yoki misol keltirish eng zo'r qutqaruvchi hisoblanadi.\n\nSavol: <i>\"Do you like reading?\"</i>\nJavob: <i>\"Yes, absolutely. In fact, just last week I finished a fascinating novel about...\"</i> deb davom etib keting.",
      used: false
    }
  ],
  "reading-listening": [
    {
      id: "reading_fb_1",
      text: "📖 <b>IELTS Reading Strategy</b>\n━━━━━━━━━━━━━━━━━━━━\nReading da vaqt yetishmasligining eng katta sababi – hamma so'zni tushunishga harakat qilishdir.\n\nSiz matnni o'qib zavq olishingiz kerak emas, faqat kerakli javobni topib olishingiz kifoya. Noma'lum so'zga duch kelsangiz, uning ma'nosini matn kontekstidan taxmin qiling yoki umuman e'tibor bermay o'tib keting.\n\nSkimming (tezkor ko'z yugurtirish) mahorati – sizni past ballardan qutqaruvchi asosiy quroldir.",
      used: false
    },
    {
      id: "listening_fb_1",
      text: "🎧 <b>IELTS Listening Strategy</b>\n━━━━━━━━━━━━━━━━━━━━\nMultiple Choice (A, B, C) savollarida audioda har doim uchala variant ham qandaydir shaklda tilga olinadi!\n\nShuning uchun, siz eshitgan birinchi tanish so'zni darhol to'g'ri javob deb belgilashga shoshilmang. Ko'pincha birinchi aytilgan variant keyingi gapda inkor qilinadi. Buni \"Distractor\" (chalg'ituvchi) deb atashadi.\n\nFikrini oxirigacha eshitib, keyin xulosa qiling.",
      used: false
    }
  ],
  "band-score-tips": [
    {
      id: "band_fb_1",
      text: "🎯 <b>Band Score Oshirish</b>\n━━━━━━━━━━━━━━━━━━━━\nGrammar range'ni oshirish uchun faqat murakkab zamonlardan foydalanish shart emas.\n\nJuda oddiy usul: bitta oddiy gap va bitta murakkab gapni aralashtirib yozing. Inversion, conditional (If) gaplar yoki passive voice'ni 2-3 marta o'z o'rnida ishlatish Band 7.0 uchun yetarli bo'ladi.\n\nEsda tuting: gramatika murakkab bo'lishi emas, to'g'ri va xatosiz bo'lishi muhimroq.",
      used: false
    }
  ],
  motivation: [
    {
      id: "mot_fb_1",
      text: "💪 <b>IELTS Motivatsiya</b>\n━━━━━━━━━━━━━━━━━━━━\nIELTS tayyorgarligi marafonga o'xshaydi. Ko'pchilik o'quvchilar bir necha oy tinimsiz o'qib, imtihonga yaqin qolganda qattiq charchoq (burnout) his qilishadi.\n\nMiya ma'lumot qabul qilishdan bosh tortadi, test natijalari tushib ketadi. Bu juda normal fiziologik jarayon. Bunday paytda o'zingizni zo'rlash vaziyatni yanada yomonlashtiradi.\n\nAgar o'zingizda charchoq his qilsangiz, bugun kitoblarni yoping. 1-2 kun to'liq dam oling. Qaytib kelganingizda miyangiz ma'lumotlarni ancha tezroq hazm qilishni boshlaydi.",
      used: false
    },
    {
      id: "mot_fb_2",
      text: "💪 <b>IELTS Motivatsiya</b>\n━━━━━━━━━━━━━━━━━━━━\nKo'pincha o'quvchilar 6.0 yoki 6.5 ballda qotib qolishadi. Qancha ko'p test ishlamasin, natija oshmaydi. Bu holat 'plateau' deb ataladi.\n\nAslida muammo ko'p test ishlashda emas, balki xatolarni tahlil qilmaslikda. Faqat test yechish orqali ball oshmaydi, xatolarning tub negizini topish kerak.\n\nBugun yangi test ishlamang. Kecha ishlagan testingizdagi xatolaringizni oling va aynan NIMA UCHUN adashganingizni chuqur tahlil qiling.",
      used: false
    }
  ]
};

console.log("🔄 Barcha zaxira bazalarini qo'lda (offline) yangilash boshlandi...");

for (const [type, items] of Object.entries(fallbacks)) {
  const dbPath = path.join(__dirname, `../content/${type}.json`);
  fs.writeFileSync(dbPath, JSON.stringify(items, null, 2));
  console.log(`✅ ${type}.json muvaffaqiyatli saqlandi! (${items.length} ta post)`);
}

console.log('🎉 Zaxira bazalari yangilandi va tayyor!');
