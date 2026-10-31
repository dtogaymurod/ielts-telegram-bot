# Postlarni aniq vaqtda chiqarish (cron-job.org)

GitHub'ning o'z jadvali (`schedule`) postlarni 3–6 soat kechiktirib chiqarardi:
19:30 dagi post 22:30–01:00 da, 12:00 dagi post esa 17:45–19:15 da chiqardi.
Shuning uchun jadval o'chirildi. Endi postlarni bepul **cron-job.org** taymeri
aniq vaqtda ishga tushiradi: u GitHub'ga "hozir chiqar" degan buyruq yuboradi.

Bir marta sozlanadi, taxminan 10 daqiqa oladi.

## 1. GitHub token yarating

1. https://github.com/settings/personal-access-tokens/new sahifasini oching.
2. **Token name:** `cron-job`, **Expiration:** 1 yil (yoki "No expiration").
3. **Repository access:** *Only select repositories* → `ielts-telegram-bot`.
4. **Permissions → Repository permissions → Actions:** *Read and write*.
5. **Generate token** ni bosing va tokenni nusxalab oling (u faqat bir marta ko'rinadi).

Tokenni hech kimga yubormang, chatga ham yozmang. U faqat cron-job.org ga kiritiladi.

## 2. cron-job.org da 4 ta vazifa yarating

https://cron-job.org da bepul ro'yxatdan o'ting, keyin har biri uchun **Create cronjob**:

| # | Title | Vaqt (Asia/Tashkent) | URL oxiri | Body |
|---|---|---|---|---|
| 1 | Kundalik post | Har kuni 19:30 | `auto-post.yml/dispatches` | `{"ref":"main"}` |
| 2 | Kunduzgi post | Har kuni 12:00 | `genz-posts.yml/dispatches` | `{"ref":"main","inputs":{"kind":"auto"}}` |
| 3 | Ko'rib chiqish | Har kuni 21:00 | `review.yml/dispatches` | `{"ref":"main","inputs":{"mode":"preview"}}` |
| 4 | Eslatma | Har kuni 09:00 | `review.yml/dispatches` | `{"ref":"main","inputs":{"mode":"remind"}}` |

3 va 4-vazifalar faqat tasdiqlash tizimi yoqilganda ishlaydi (pastdagi 4-bo'lim).
Yoqilmagan bo'lsa, ular hech narsa qilmaydi.

To'liq URL: `https://api.github.com/repos/dtogaymurod/ielts-telegram-bot/actions/workflows/` + URL oxiri.

Har bir vazifada:

- **Common** tabi: URL ni kiriting. *Execution schedule* → *Custom*, kun va vaqtni tanlang.
  **Time zone:** `Asia/Tashkent`.
- **Advanced** tabi:
  - **Request method:** `POST`
  - **Headers** (3 ta):
    - `Accept` = `application/vnd.github+json`
    - `Authorization` = `Bearer <1-qadamdagi token>`
    - `X-GitHub-Api-Version` = `2022-11-28`
  - **Request body:** jadvaldagi Body.
- **Save**.

## 3. Tekshirish

Vazifa ro'yxatida **Test run** ni bosing. Javob `204` bo'lsa, hammasi to'g'ri:
GitHub → **Actions** sahifasida yangi ishga tushirish paydo bo'ladi.
Kanalga sinov posti chiqmasligi uchun avval GitHub Actions'da workflow'ni
qo'lda **dry_run** belgisi bilan ishga tushirib ko'rish mumkin.

`401` yoki `403` chiqsa, token yoki uning *Actions: Read and write* ruxsati noto'g'ri.
`404` chiqsa, URL dagi fayl nomini tekshiring.

## 4. Tasdiqlash tizimini yoqish

Yoqilgandan keyin har bir post avval sizga ko'rsatiladi va faqat siz tasdiqlasangiz kanalga chiqadi:

- **21:00** — bot sizga ertangi 12:00 va 19:30 postlarini kanalda qanday ko'rinsa, xuddi shunday yuboradi.
  Har birining tagida **✅ Chiqsin** va **❌ Chiqmasin** tugmalari bo'ladi.
- **09:00** — hali javob bermagan postlar bo'lsa, eslatma keladi.
- **12:00 / 19:30** — faqat ✅ bosilgan post chiqadi. Javob berilmagan yoki ❌ bosilgan post chiqmaydi
  va navbatda birinchi bo'lib qoladi (keyingi safar yana sizga ko'rsatiladi).
- Post chiqquncha fikringizni o'zgartirishingiz mumkin: boshqa tugmani bossangiz, oxirgisi hisoblanadi.
- Tugmani bosganda darhol javob kelmaydi, bu normal: holat (✅ Tasdiqlandi) 09:00 da yoki post vaqtida yangilanadi.

Yoqish uchun 3 qadam:

1. Telegram'da botingizni oching va **Start** ni bosing (bot sizga yoza olishi uchun kerak).
2. **@userinfobot** ga istalgan xabar yozing. U sizga raqamli **Id** ni yuboradi (masalan `123456789`).
3. GitHub'da: repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   **Name:** `TELEGRAM_ADMIN_ID`, **Secret:** 2-qadamdagi raqam. **Add secret**.

O'chirish uchun shu secretni o'chirib tashlang: bot yana avvalgidek to'g'ridan-to'g'ri kanalga chiqaradi.

Muhim: Gemini'ning 19:30 posti endi bir kun oldin, 21:00 da yoziladi, shunda siz aynan chiqadigan matnni tasdiqlaysiz.
