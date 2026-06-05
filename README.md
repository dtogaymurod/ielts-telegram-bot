# 🎓 IELTS Telegram Bot — Avtomatik Post

Telegram kanalingizga har kuni avtomatik IELTS tayyorgarlik kontentlari yuboruvchi bot.

## ✨ Xususiyatlari

- 📅 **Kuniga 3 ta post** — ertalab (08:00), tushlik (13:00), kechqurun (20:00)
- 🤖 **AI generatsiya** — Gemini AI yangi kontentlar yaratadi
- 📦 **Tayyor baza** — 200+ tayyor post (AI ishlamasa)
- ❓ **Interaktiv quizlar** — Telegram poll/quiz formatida
- 🔄 **Avtomatik rotation** — Takrorlanmaslik uchun tracking
- 🆓 **Bepul hosting** — GitHub Actions orqali

## 📋 Kontent turlari

| Tur | Emoji | Chastotasi |
|-----|-------|------------|
| Vocabulary | 📚 | Haftada 4 marta |
| Writing Tips | ✍️ | Haftada 3 marta |
| Speaking Tips | 🗣 | Haftada 4 marta |
| Reading/Listening | 📖🎧 | Haftada 3 marta |
| Quizlar | ❓ | Haftada 3 marta |
| Band Score Tips | 🎯 | Haftada 2 marta |
| Motivatsiya | 💪 | Haftada 2 marta |

## 🚀 O'rnatish

### 1. Telegram Bot yaratish

1. Telegram da [@BotFather](https://t.me/BotFather) ga yozing
2. `/newbot` buyrug'ini yuboring
3. Bot nomini va username ni kiriting
4. **Bot Token** ni saqlang

### 2. Botni kanalga qo'shish

1. Kanalingiz sozlamalari → Administratorlar → Admin qo'shish
2. Bot username ni qidiring va qo'shing
3. **"Post Messages"** ruxsatini bering

### 3. Gemini API Key olish

1. [Google AI Studio](https://aistudio.google.com/apikey) ga kiring
2. API key yarating va saqlang

### 4. GitHub ga push qilish

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/USERNAME/ielts-telegram-bot.git
git push -u origin main
```

### 5. GitHub Secrets sozlash

Repository → Settings → Secrets and variables → Actions → New repository secret:

| Secret nomi | Qiymati |
|------------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot token (@BotFather dan) |
| `TELEGRAM_CHANNEL_ID` | `@kanal_username` yoki `-100xxxxxxxxxx` |
| `GEMINI_API_KEY` | Google Gemini API key |

### 6. Tayyor! ✅

Bot avtomatik ishga tushadi. Qo'lda test qilish uchun:

Repository → Actions → "IELTS Channel Auto-Post" → Run workflow

## 🧪 Lokal test

```bash
# Dependencies o'rnatish
npm install

# Dry run (yubormasdan ko'rish)
npm run dry-run

# Aniq kontent turini test qilish
CONTENT_TYPE=vocabulary npm run dry-run
CONTENT_TYPE=quiz npm run dry-run
```

## 📁 Loyiha strukturasi

```
├── .github/workflows/
│   └── auto-post.yml       # GitHub Actions cron schedule
├── src/
│   ├── index.js             # Asosiy entry point
│   ├── telegram.js          # Telegram Bot API
│   ├── gemini.js            # Gemini AI generator
│   ├── content-selector.js  # Kontent tanlash logikasi
│   ├── formatter.js         # Post formatlash
│   └── quiz-generator.js    # Quiz generatsiya
├── content/
│   ├── vocabulary.json      # 30+ so'zlar
│   ├── writing-tips.json    # 30+ yozuv maslahatlari
│   ├── speaking-tips.json   # 30+ gapirish maslahatlari
│   ├── reading-listening.json  # 30+ strategiyalar
│   ├── band-score-tips.json # 30+ ball oshirish
│   ├── motivation.json      # 30+ motivatsiya
│   └── quizzes.json         # 30+ quiz savollari
├── package.json
├── .env.example
└── README.md
```

## 📝 Litsenziya

MIT
