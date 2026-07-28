# Prompt كامل لكلود — ربط «راتبي» مع «رُشد» عبر Firebase

أنت المسؤول التنفيذي عن تعديل تطبيق «راتبي» الموجود في المستودع التالي:

`https://github.com/hamza00555-sketch/workout-tracker-hamza`

نفّذ الربط كاملًا بالكود والاختبارات والفرع والـcommit والـPull Request. لا تعطِني خطة عامة ولا مقتطفات أضعها يدويًا.

## 1. الفرع الصحيح وحدود العمل

- فرع الإنتاج الصحيح لتطبيق «راتبي» هو `ratebi`.
- فرع `main` خاص بتطبيق التمارين HamzaFit؛ ممنوع تعديله.
- أنشئ فرع عمل جديدًا من أحدث `origin/ratebi` باسم:
  `claude/ratibi-rushd-firebase-sync`
- لا تبنِ الربط فوق فرع `claude/continue-session-gCVKM`.
- الفرع المذكور يحتوي تجارب غير مدمجة:
  - `3c927a2` أضاف Upstash وMCP ومفتاح API.
  - `49b3e62` أضاف Webhook يدويًا.
  - `2f7eb09` حذف واجهة استيراد قديمة.
- لا تنقل Upstash أو Webhook أو MCP أو `RATEBI_API_KEY` إلى فرع الربط الجديد.
- لا تلمس مجلد `hamzafit/`.
- لا تعدّل `src/components/BottomNav.jsx`.
- لا تعِد تصميم التطبيق. حافظ على RTL والخطوط والألوان والمكونات الحالية.
- رابط إنتاج «راتبي»:
  `https://ratebi-salary-app2.vercel.app`
- رابط إنتاج «رُشد»:
  `https://rushd-app-nine.vercel.app`

## 2. الهدف النهائي

«راتبي» هو مصدر إدخال المعلومات المالية. «رُشد» يعرضها ويرتبها ولا يطلب من المستخدم إدخالها مرة ثانية.

المطلوب:

1. المستخدم يسجل دخوله داخل «راتبي» بنفس البريد وكلمة المرور المستخدمة في «رُشد».
2. يضغط «ربط رُشد» مرة واحدة.
3. يبني «راتبي» حزمة مالية شهرية من بيانات IndexedDB الحقيقية.
4. يرسل الحزمة مباشرة إلى Firestore في مساحة المستخدم الخاصة.
5. بعد الربط، أي تعديل مالي في «راتبي» يرسل نسخة محدثة تلقائيًا بعد debounce قصير.
6. «رُشد» يلتقط التحديث تلقائيًا؛ لا نسخ ولا لصق ولا Webhook ولا JSON ظاهر للمستخدم.
7. يبقى IndexedDB هو المصدر المحلي الأساسي لتطبيق «راتبي». لا تنقل قاعدة التطبيق كلها إلى Firebase.

## 3. التقنية المعتمدة

استخدم Firebase Client SDK فقط:

- Firebase Authentication بالبريد وكلمة المرور.
- Cloud Firestore.
- نفس مشروع Firebase الخاص بتطبيق «رُشد»:
  `rushd-app-fd5a8`

لا تستخدم:

- Service Account.
- Firebase Admin SDK.
- Private Keys.
- Cloud Functions.
- Supabase.
- Upstash.
- Redis.
- API routes.
- Webhooks.
- MCP لهذا الربط.

أضف حزمة `firebase` إلى dependencies.

أنشئ:

- `src/lib/firebase.js`
- `src/lib/rushdBundle.js`
- `src/lib/rushdSync.js`
- `.env.example`
- `scripts/ratibi-rushd-bundle-test.mjs`

يمكنك تقسيم الملفات بصورة أفضل إذا احتاج الكود، بشرط بقاء المحول المالي pure وقابلًا للاختبار دون Firebase أو React.

## 4. إعداد Firebase

استخدم متغيرات Vite التالية فقط:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

الشروط:

- لا تضع Firebase config مكتوبًا مباشرة في المستودع.
- لا تضع `.env` الحقيقي في Git.
- حدّث `.gitignore` عند الحاجة.
- إذا كانت المتغيرات ناقصة، يبقى «راتبي» المحلي شغالًا، لكن تظهر في قسم الربط رسالة عربية واضحة:
  `ربط رُشد غير مهيأ في هذه النسخة.`
- لا تسجل config أو tokens في console.
- استخدم `browserLocalPersistence`، ومع fallback إلى `browserSessionPersistence` إذا تعذر.
- استخدم Firestore persistent local cache عندما يدعم المتصفح ذلك، مع fallback آمن إلى `getFirestore`.
- اضبط لغة Firebase Auth على العربية.

## 5. تسجيل الدخول والربط

داخل `src/pages/Settings.jsx` أضف قسمًا بعنوان:

`ربط رُشد`

لا تغيّر أقسام الإعدادات الأخرى.

### الحالة غير المتصلة

اعرض:

- شرحًا قصيرًا أن المستخدم يدخل بنفس حساب «رُشد».
- حقل البريد الإلكتروني.
- حقل كلمة المرور.
- زرًا رئيسيًا: `ربط رُشد`
- رابطًا يفتح رُشد لإنشاء حساب إذا لم يكن لديه حساب:
  `https://rushd-app-nine.vercel.app`

استخدم:

```js
signInWithEmailAndPassword(auth, email, password)
```

لا تنشئ حسابًا جديدًا من «راتبي». إنشاء الحساب يبقى داخل «رُشد» حتى يتم إنشاء ملف المستخدم والبيت بصورة صحيحة.

### الحالة المتصلة

اعرض:

- `متصل برُشد`
- بريد المستخدم بشكل مخفي جزئيًا.
- آخر وقت مزامنة ناجح.
- حالة: `جاري المزامنة` أو `تمت المزامنة` أو `تعذر التحديث`.
- زر `مزامنة الآن`.
- زر ثانوي `فصل رُشد` ينفذ `signOut`.

### قواعد كلمة المرور

- كلمة المرور تبقى داخل state أثناء النموذج فقط.
- لا تحفظها في IndexedDB.
- لا تحفظها في settings.
- لا ترسلها إلى Firestore.
- امسحها من state بعد نجاح أو فشل محاولة الدخول.

### رابط الفتح من رُشد

عندما يُفتح «راتبي» مع:

`?connect=rushd`

انتقل إلى صفحة الإعدادات وافتح أو مرّر تلقائيًا إلى قسم «ربط رُشد» بعد تحميل التطبيق. لا تضع أي بيانات مالية أو token في الرابط.

## 6. مسار Firestore

اكتب الحزمة الشهرية في:

`users/{uid}/ratibiSync/{yyyy-mm}`

اكتب المستند كاملًا بهذه الصيغة فقط:

```js
await setDoc(
  doc(firestore, 'users', user.uid, 'ratibiSync', bundle.month),
  {
    sourceApp: 'ratibi',
    sourceVersion: 1,
    bundle,
    updatedAt: serverTimestamp(),
  },
)
```

لا تكتب مباشرة إلى:

- `users/{uid}/monthlyPlans`
- `households`
- `investmentAccounts`
- `financialGoals`
- أي بيانات مستخدم آخر

«رُشد» هو المسؤول عن تحويل حزمة المزامنة إلى حساب الشهر.

## 7. المخطط الإلزامي

استخدم المخطط التالي حرفيًا:

```ts
type RatibiAdditionalIncome = {
  id: string
  title: string
  amount: number
}

type RatibiObligation = {
  id: string
  title: string
  amount: number
  paidAmount: number
  dueDate: string | null
  category: string | null
}

type RatibiGoal = {
  id: string
  title: string
  target: number
  saved: number
  monthlyAllocation: number
  contributedThisMonth: number
  deadline: string | null
  category: string | null
}

type RatibiBudgetKind =
  | 'living'
  | 'supermarket'
  | 'flexible'
  | 'other'

type RatibiBudget = {
  id: string
  title: string
  limit: number
  spent: number
  kind: RatibiBudgetKind
}

type RatibiAccount = {
  id: string
  title: string
  type: string
  balance: number | null
}

type RatibiTransaction = {
  id: string
  title: string
  amount: number
  category: string | null
  occurredAt: string
}

type RatibiFinanceBundleV1 = {
  schema: 'ratibi.rushd.finance'
  version: 1
  exportedAt: string
  month: string
  currency: 'SAR'
  profile: {
    displayName: string | null
    salaryDay: number | null
  }
  income: {
    salary: number
    additional: RatibiAdditionalIncome[]
  }
  obligations: RatibiObligation[]
  goals: RatibiGoal[]
  budgets: RatibiBudget[]
  accounts: RatibiAccount[]
  transactions: RatibiTransaction[]
}
```

## 8. مصدر البيانات الحقيقي في «راتبي»

قاعدة IndexedDB الحالية:

`ratebi-db` إصدار 3.

الدالة الموجودة:

```js
db.exportAll()
```

تعيد:

```js
{
  settings,
  commitments,
  goals,
  expenses,
  banks,
  monthlyRecords,
  debts,
  extraIncome,
  exportDate
}
```

حوّل `settings` من قائمة `{ key, value }` إلى object.

استخدم utility الشهر الحالية من المشروع إن كانت صحيحة، وإلا أنشئ utility صغيرة تعيد `YYYY-MM` بالتوقيت المحلي.

## 9. قواعد التحويل الدقيقة

أنشئ دالة pure:

```js
buildRushdFinanceBundle({
  rawSnapshot,
  month,
  displayName,
  exportedAt,
})
```

وتعيد `RatibiFinanceBundleV1`.

### الشهر

- `month` بصيغة `YYYY-MM`.
- الافتراضي هو الشهر المحلي الحالي.
- استخدم `exportedAt = new Date().toISOString()`.

### الراتب

ابحث عن سجل الشهر:

```js
const record = monthlyRecords.find(item => item.month === month)
```

ثم:

```js
salary = record?.salary ?? settings.salary
```

إذا كان الراتب غير موجود أو ليس رقمًا موجبًا:

- لا تكتب أي مستند.
- اعرض: `أكمل إعداد الراتب في راتبي قبل ربط رُشد.`

### الدخل الإضافي

خذ عناصر `extraIncome` التي ينتمي تاريخها إلى الشهر المطلوب.

التحويل:

```js
{
  id: item.id,
  title: item.source || 'دخل إضافي',
  amount: item.amount
}
```

### الالتزامات

خذ `commitments` التي `active !== false`.

التحويل:

```js
{
  id: commitment.id,
  title: commitment.name,
  amount: commitment.amount,
  paidAmount: commitment.paidThisMonth ? commitment.amount : 0,
  dueDate: ISO_DATE_OR_NULL,
  category: commitment.category || null
}
```

كوّن `dueDate` من الشهر و`dayOfMonth`. عالج نهاية الشهر بصورة صحيحة؛ اليوم 31 في فبراير يتحول إلى آخر يوم صالح من الشهر، وليس إلى شهر تالٍ.

### الأهداف

خذ الأهداف التي `completed !== true`.

التحويل:

```js
{
  id: goal.id,
  title: goal.name,
  target: goal.targetAmount,
  saved: Math.min(goal.savedAmount || 0, goal.targetAmount),
  monthlyAllocation: goal.monthlyContribution || 0,
  contributedThisMonth: record?.goalContribs?.[goal.id] || 0,
  deadline: goal.targetDate || null,
  category: goal.category || null
}
```

### الميزانيات

لا تُنشئ أي حقول أو إعدادات خاصة بميزانية الأماني في «راتبي»، ولا ترسل عنصرًا من النوع `wishes`. ميزانية الأماني يحددها المستخدم من صفحة الأماني داخل رُشد وتبقى مستقلة تمامًا عن المزامنة.

أنشئ ميزانية مرنة من المتبقي بعد الالتزامات والأهداف:

```js
{
  id: 'flexible',
  title: 'المصروف المرن',
  limit: Math.max(0, record?.remaining ?? calculatedRemaining),
  spent: currentMonthExpensesTotal,
  kind: 'flexible'
}
```

5. لا ترسل `kind: 'supermarket'` حاليًا؛ ميزانية السوبرماركت في «رُشد» مشتركة ويحددها رب الأسرة داخل رُشد.

### الحسابات

حوّل كل حساب داخل كل بنك:

```js
{
  id: `${bank.id}:${account.id}`,
  title: `${bank.name} — ${account.name}`,
  type: 'حساب بنكي',
  balance: null
}
```

لا ترسل أرقام حسابات أو بطاقات أو IBAN.

### الحركات

خذ `expenses` التي `expense.month === month`.

التحويل:

```js
{
  id: expense.id,
  title: expense.note || expense.title || 'مصروف',
  amount: expense.amount,
  category: expense.category || null,
  occurredAt: VALID_ISO_DATE
}
```

إذا لم يوجد تاريخ صالح، استخدم تاريخًا داخل الشهر بصورة حتمية، وليس `new Date()` المتغير داخل الاختبار.

### الملف الشخصي

```js
profile: {
  displayName: firebaseUser.displayName || 'مستخدم راتبي',
  salaryDay: settings.salaryDay || null
}
```

لا تستخدم البريد كاسم، ولا ترسل البريد داخل الحزمة.

## 10. التحقق والتنظيف

قبل الكتابة:

- جميع المبالغ أرقام finite وليست strings.
- المبالغ صفر أو موجبة.
- الراتب أكبر من صفر.
- `paidAmount <= amount`.
- `saved <= target`.
- `spent <= limit`.
- النصوص مقصوصة ومحدودة الطول.
- كل قائمة بحد أقصى 200 عنصر.
- المعرفات غير فارغة.
- التواريخ ISO 8601 صالحة.
- `currency === 'SAR'`.
- `schema === 'ratibi.rushd.finance'`.
- `version === 1`.

لا تستخدم `JSON.parse(JSON.stringify(...))` كبديل عن التحقق الحقيقي.

## 11. المزامنة التلقائية

نفّذ الحالات:

```js
'unconfigured'
'disconnected'
'connecting'
'syncing'
'connected'
'offline'
'error'
```

شغّل المزامنة:

1. فور نجاح ربط الحساب.
2. عند ضغط `مزامنة الآن`.
3. بعد تعديل البيانات المالية، مع debounce بين 800 و2000ms.
4. عند عودة الاتصال إذا كانت هناك تغييرات معلقة.
5. عند فتح التطبيق والمستخدم متصل.

استخدم `db.exportAll()` في لحظة بناء الحزمة حتى تشمل المصروفات الموجودة في IndexedDB، حتى لو لم تكن `expenses` موجودة في React Context.

لا تنشئ loop:

- لا تعِد الكتابة بسبب metadata-only snapshot.
- لا تكتب إذا لم تتغير البيانات المالية منذ آخر حزمة، باستثناء `exportedAt`.
- احسب fingerprint ثابتًا من المحتوى المالي بدون `exportedAt`، واحفظ آخر fingerprint محليًا.
- عند عدم تغير fingerprint، لا تنفذ write تلقائيًا.
- زر `مزامنة الآن` يستطيع إجبار إنشاء نسخة جديدة.

## 12. الخصوصية

ممنوع إرسال أو تسجيل:

- البريد داخل الحزمة المالية.
- كلمة المرور.
- PIN أو `pinHash`.
- WebAuthn credentials.
- Firebase ID token أو refresh token.
- `cloudApiKey`.
- `webhookUrl`.
- API keys.
- أرقام البطاقات.
- أرقام الحسابات البنكية.
- IBAN.
- النسخة الكاملة من settings.

لا تستخدم `console.log` للحزمة أو بيانات الراتب.

المسموح فقط هو الحقول المحددة في `RatibiFinanceBundleV1`.

## 13. التعامل مع الأخطاء

استخدم رسائل عربية واضحة:

- حساب غير موجود:
  `لم نجد حساب رُشد بهذا البريد. أنشئ حسابك في رُشد أولًا.`
- كلمة مرور غير صحيحة:
  `البريد أو كلمة المرور غير صحيحة.`
- نطاق غير مصرح:
  `نطاق راتبي غير مضاف إلى Firebase Authentication.`
- Firebase غير مهيأ:
  `ربط رُشد غير مهيأ في هذه النسخة.`
- لا يوجد راتب:
  `أكمل إعداد الراتب في راتبي قبل ربط رُشد.`
- دون اتصال:
  `أنت دون اتصال. سنزامن عند عودة الإنترنت.`
- رفض قواعد Firestore:
  `تعذر حفظ المزامنة في حساب رُشد. تحقق من إعدادات الربط.`

لا تعرض stack trace للمستخدم.

## 14. الاختبارات

أضف في `package.json`:

```json
"test:rushd-sync": "node scripts/ratibi-rushd-bundle-test.mjs"
```

اختبر على الأقل:

1. تحويل settings array إلى object.
2. اختيار راتب سجل الشهر قبل الراتب العام.
3. فلترة الدخل الإضافي حسب الشهر.
4. الالتزامات النشطة فقط.
5. `paidThisMonth` إلى `paidAmount`.
6. ضبط يوم 31 إلى آخر يوم صالح من الشهر.
7. الأهداف غير المكتملة فقط.
8. عدم تجاوز saved للهدف.
9. عدم تصدير ميزانية الأماني لأنها تُدار داخل رُشد.
10. المصروف المرن.
11. البنوك والحسابات.
12. مصروفات الشهر فقط.
13. عدم وجود البريد أو PIN أو token أو API key في الحزمة.
14. رفض راتب صفر.
15. رفض NaN وInfinity والأرقام النصية.
16. الحد الأقصى 200 عنصر.
17. fingerprint ثابت عند عدم تغير البيانات.

ثم شغّل:

```bash
npm run test:rushd-sync
npm run build
```

نفّذ مراجعة واجهة على:

- 390 × 844
- 393 × 852
- 430 × 932

وتأكد من:

- RTL.
- عدم وجود horizontal scroll.
- عدم تغطية زر الربط بواسطة BottomNav.
- عمل لوحة المفاتيح على iPhone.
- إخفاء كلمة المرور.
- وضوح حالات loading/error/offline.

## 15. التوثيق

حدّث `RATEBI_CONTEXT.md` ليذكر:

- ربط Firebase مع رُشد.
- أسماء الملفات الجديدة.
- متغيرات البيئة.
- مسار Firestore.
- أن IndexedDB هو المصدر الأساسي.
- أن فرع الإنتاج ما زال `ratebi`.
- أن Upstash وWebhook وMCP ليست جزءًا من الربط.

أضف ملفًا:

`docs/RUSHD_INTEGRATION.md`

يحتوي مواصفة الربط كاملة، وليس مقتطفات.

## 16. Git وPull Request

بعد نجاح الاختبارات:

1. تأكد أن التغييرات تخص تطبيق «راتبي» فقط.
2. تأكد أن `hamzafit/` و`BottomNav.jsx` لم يتغيرا.
3. نفّذ commit واضحًا.
4. ادفع الفرع:
   `claude/ratibi-rushd-firebase-sync`
5. افتح Pull Request إلى `ratebi`، وليس `main`.
6. لا تدمج قبل نجاح Vercel Preview واختبار تسجيل الدخول والمزامنة الحية.

عنوان PR:

`ربط راتبي برُشد عبر Firebase`

وصف PR يجب أن يذكر:

- ما تم.
- الملفات المتغيرة.
- الاختبارات.
- متغيرات Vercel المطلوبة.
- خطوة Firebase Authorized Domains المطلوبة.
- أي عائق حقيقي فقط.

## 17. شروط القبول

لا تعتبر المهمة مكتملة إلا إذا:

- «راتبي» يعمل محليًا دون Firebase عند عدم تهيئة الربط.
- المستخدم يستطيع ربط حساب رُشد بنفس بيانات الدخول.
- لا تُحفظ كلمة المرور.
- حزمة الشهر تُبنى من IndexedDB الحقيقي.
- المستند يُكتب في `users/{uid}/ratibiSync/{yyyy-mm}`.
- لا تُكتب البيانات في مساحة مستخدم آخر.
- لا يوجد نسخ أو لصق في التدفق الطبيعي.
- لا توجد بيانات مالية في URL أو console أو analytics.
- المزامنة التلقائية لا تكرر writes بلا داعٍ.
- الاختبارات والبناء ناجحان.
- Vercel Preview جاهز.
- لم يتغير HamzaFit أو BottomNav.
- لم يُضف Upstash أو Webhook أو MCP أو Supabase أو Service Account.

في تقريرك النهائي أعطني روابط الفرع وPR وVercel Preview، ونتائج الاختبارات، وأي إعداد Firebase/Vercel لم تستطع تنفيذه بسبب الصلاحيات.
