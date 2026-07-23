# رُشد — Rushd

تطبيق مالي عربي، Mobile-first وRTL، مبني على React وTypeScript وVite وFirebase.

## الوظائف الحالية

- حسابات مستقلة عبر Firebase Authentication.
- خطط شهرية ومصروفات خاصة بكل مستخدم في Cloud Firestore.
- سوبرماركت وأماني مشتركة بصلاحيات عرض أو تعديل أو بدون وصول.
- محافظ وأهداف مالية وسيناريوهات ترقية خاصة بصاحب الحساب.
- واجهة PWA محسنة للآيفون مع تخزين محلي ومزامنة عند عودة الاتصال.

## التشغيل المحلي

```bash
npm install
cp .env.example .env.local
npm run dev
```

يمكن استخدام متغيرات `VITE_FIREBASE_*` من `.env.example`. يحتوي المستودع حاليًا أيضًا على Firebase Web Client Config العام لدعم نشر Vercel القائم؛ التفاصيل الأمنية موثقة في `SECURITY.md`.

## التحقق

```bash
npm run typecheck
npm run test:rules
npm run build
node scripts/firebase-live-smoke.mjs
```
