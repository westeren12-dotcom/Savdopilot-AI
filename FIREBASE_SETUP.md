# 🔐 Firebase Authentication — Sozlash yo'riqnomasi

Bu yo'riqnoma ~10 daqiqa oladi. Oxirida **Google bilan kirish** va **email/parol bilan
ro'yxatdan o'tish** haqiqiy ishlaydi (hech qanday soxta signup yo'q).

Kod to'liq tayyor: `src/lib/firebase.ts` (init), `src/services/auth.ts` (barcha auth
funksiyalari). Faqat kalitlarni `.env` ga qo'yish va Console'da 3 ta sozlash kerak.

## 1. Firebase loyihasi yarating

1. https://console.firebase.google.com → **Add project**
2. Nom: `savdopilot-ai` (yoki istalgan) → Analytics ixtiyoriy → **Create**

## 2. Web App qo'shib, kalitlarni oling

1. Project Overview → **`</>`** (Web) belgisini bosing
2. App nickname: `savdopilot-web` → **Register app**
3. Sizga `firebaseConfig` ko'rsatiladi — u yerdagi qiymatlar keyingi qadamga kerak

## 3. `.env` ga kalitlarni yozing

Loyihaning ildizidagi `.env` fayliga quyidagini qo'shing (qiymatlarni 2-qadamdagilar
bilan almashtiring):

```env
VITE_FIREBASE_API_KEY=AIzaSy...real-key...
VITE_FIREBASE_AUTH_DOMAIN=savdopilot-ai.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=savdopilot-ai
VITE_FIREBASE_STORAGE_BUCKET=savdopilot-ai.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123def456
```

`.env` fayli `.gitignore`da — GitHub'ga tushmaydi. `.env.example` faqat template.

> ⚠️ Web API key brauzerda ko'rinadi — bu Firebase tomonidan normal (Firebase Security
> Rules bilan himoyalanadi). **Hech qachon** Admin SDK / service-account kalitlarini
> frontend'ga qo'ymang.

## 4. Firebase Console'da 3 ta sozlash

### 4.1 Authentication yoqing

1. Chap menyu → **Build → Authentication → Get started**
2. **Sign-in method** tab → quyidagilarni **Enable** qiling:
   - **Email/Password** → toggle ON → Save
   - **Google** → toggle ON → support email tanlang → Save

### 4.2 Authorized domains

1. **Authentication → Settings → Authorized domains**
2. **Add domain**:
   - `localhost` (default'da bor)
   - Production domen, masalan `savdopilot.vercel.app`

Bu qadam tushurib qoldirilsa, Google popup: `auth/unauthorized-domain` xatosini beradi.

### 4.3 (Ixtiyoriy, production uchun) API key cheklovi

1. https://console.cloud.google.com → APIs & Services → **Credentials**
2. O'zingizning **Browser key** ni oching → **Application restrictions → HTTP referrers**
3. Faqat o'z domeningizni qo'shing: `savdopilot.vercel.app/*`, `localhost/*`

## 5. Tekshirish

Dev server qayta ishga tushiring (`npm run dev` — env o'zgarishlari faqat restart'da
o'qiladi), keyin:

1. `/register` sahifasida **"Firebase sozlanmagan" sariq banner yo'qolganini** tekshiring
2. **Ro'yxatdan o'tish**: yangi email + parol → haqiqiy Firebase hisobi yaratiladi
   (Console → Authentication → Users ro'yxatida ko'rinadi)
3. **Google bilan davom etish** → popup ochiladi → kirish ishlaydi
4. Homepage'da yo'nalish tanlang → auth → dashboard mos yo'nalishda ochiladi

## Xatolar bo'lsa

| Xato | Sababi |
| --- | --- |
| `auth/unauthorized-domain` | 4.2 — domen qo'shilmagan |
| `auth/operation-not-allowed` | 4.1 — provider enable qilinmagan |
| `auth/api-key-not-valid` | `.env` qiymati noto'g'ri / server restart qilinmagan |
| Banner hali ham ko'rinadi | `.env` saqlanmagan yoki dev server restart qilinmagan |
