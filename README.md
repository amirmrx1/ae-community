# AE — اپ اندروید (یادداشت، تسک، تایمر، پومودورو، جمله‌ی روزانه)

## بیلد APK با گیت‌هاب (بدون نصب چیزی روی سیستم)
1. یه ریپو جدید توی GitHub بساز و کل این پوشه رو پوش کن.
2. برو تب Actions → workflow به اسم "Build AE APK" → Run workflow (یا با هر push خودش اجرا می‌شه).
3. بعد از ~۵ دقیقه، از قسمت Artifacts فایل `AE-apk` رو دانلود کن → داخلش `AE.apk` هست.
4. APK رو روی گوشی نصب کن (نصب از منبع ناشناس رو فعال کن).

## بیلد لوکال (Android Studio)
    npm install
    npx cap sync android
    npx cap open android      # بعد Build > Build APK

## ویرایش
- ظاهر و منطق: پوشه‌ی `www/` (index.html, style.css, app.js)
- ۱۰۰ جمله: `www/quotes.js`
- بعد از هر تغییر: `npx cap sync android`
