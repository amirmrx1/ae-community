# AE Coach (Cloudflare Worker + Workers AI)

مربی هوشمند اپ AE. روی Workers AI اجرا می‌شه (رایگان تا ۱۰٬۰۰۰ Neuron در روز، بدون کلید API خارجی).

## راه ۱ — خودکار با GitHub Actions (پیشنهادی)
1. Cloudflare → My Profile → API Tokens → Create Token → قالب **Edit Cloudflare Workers** → Create.
2. Account ID رو از صفحه‌ی Workers & Pages (ستون سمت راست) کپی کن.
3. GitHub → ریپو → Settings → Secrets and variables → Actions → دو تا Secret بساز:
   `CLOUDFLARE_API_TOKEN` و `CLOUDFLARE_ACCOUNT_ID`.
4. تب Actions → Build AE APK → Run workflow.
   Worker خودش دیپلوی می‌شه و آدرس و کلیدش داخل APK گذاشته می‌شه (توی Summary همون اجرا آدرس رو می‌بینی).

## راه ۲ — دستی از داشبورد
1. Workers & Pages → Create → Worker → اسم `ae-coach` → Deploy → Edit code.
2. محتوای `src/index.js` رو جایگزین کن → Deploy.
3. Settings → Bindings → Add → **Workers AI** → Variable name: `AI` → Deploy.
4. آدرس Worker رو توی اپ بذار: تب «مربی» ← ⚙️ ← آدرس ← ذخیره ← تست اتصال.

## راه ۳ — Wrangler
    cd worker && npx wrangler deploy

## مسیرها
`GET /` سلامت · `POST /chat` گفتگو · `POST /plan` نقشه‌ی راه · `POST /days` قدم‌های ۷ روز

## نکته‌ها
- کلید `APP_KEY` اختیاریه؛ توی APK قرار می‌گیره، پس فقط جلوی استفاده‌ی اتفاقی رو می‌گیره، نه یه قفل واقعی.
- سهمیه‌ی رایگان ساعت ۰۰:۰۰ UTC (۳:۳۰ بامداد ایران) ریست می‌شه. بعد از تموم شدن، اپ پیام مناسب نشون می‌ده.
- مدل‌ها: `@cf/google/gemma-4-26b-a4b-it` و در صورت خطا `@cf/zai-org/glm-4.7-flash` (هر دو توی پلن رایگان).

## Accounts (register / login)
Needs a D1 database bound as `DB` (database `ae-users`, tables `users` + `sessions`; schema in `worker/schema.sql`).
Passwords are stored only as salted PBKDF2-SHA256 hashes; sessions are random tokens (stored hashed, 90 days).

### SMS verification (Melipayamak)
Worker secrets: `MELI_USER`, `MELI_PASS`, `MELI_BODY_ID` (pattern/template id whose text has one variable `{0}` = the code).
If any is missing, registration works without SMS. Codes: 5 digits, 3 min, 5 tries, 60 s gap, 5 sends/hour per number.
