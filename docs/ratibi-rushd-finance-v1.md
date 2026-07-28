# Ratibi → Rushd Finance Bundle v1

هذه هي صيغة التبادل الرسمية بين تطبيق «راتبي» وتطبيق «رُشد». «راتبي» هو مصدر الإدخال، و«رُشد» يقرأ النسخة الشهرية من قناة Firebase خاصة بالمستخدم، ثم يرتبها ويحفظها ضمن حساب الشهر.

## النقل

1. يسجل المستخدم دخوله في التطبيقين بنفس حساب Firebase.
2. يبني «راتبي» الكائن الموضح أدناه من بيانات الشهر المفتوح في IndexedDB.
3. يكتب «راتبي» الحزمة في:
   `users/{uid}/ratibiSync/{yyyy-mm}`
4. يستمع «رُشد» للمستند، ويتحقق من المخطط والإصدار والشهر والقيم.
5. عند وصول إصدار أحدث، يحوله «رُشد» تلقائيًا إلى حساب الشهر الخاص بالمستخدم.
6. يبقى الاستيراد اليدوي موجودًا كحل احتياطي فقط، وليس جزءًا من التدفق الطبيعي.

ممنوع وضع الحزمة في Query String أو URL أو الحافظة أثناء التدفق الطبيعي، وممنوع تسجيلها في `console` أو analytics.

جلسة Firebase في الويب مرتبطة بنطاق التطبيق؛ لذلك يسجل المستخدم دخوله مرة واحدة داخل «راتبي» ومرة واحدة داخل «رُشد». لا تُخزن كلمة المرور في IndexedDB أو Firestore.

## غلاف مستند Firestore

يكتب «راتبي» المستند كاملًا بهذه الصيغة فقط:

```ts
type RatibiSyncDocumentV1 = {
  sourceApp: 'ratibi'
  sourceVersion: 1
  bundle: RatibiFinanceBundleV1
  updatedAt: FieldValue // serverTimestamp()
}
```

مثال الكتابة:

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

قواعد Firestore تسمح لصاحب `uid` فقط بقراءة وكتابة هذه القناة، وتتحقق من الشهر والمخطط والقوائم قبل قبول المستند.

## المخطط

```ts
type RatibiFinanceBundleV1 = {
  schema: 'ratibi.rushd.finance'
  version: 1
  exportedAt: string // ISO 8601
  month: string // YYYY-MM
  currency: 'SAR'
  profile: {
    displayName: string | null
    salaryDay: number | null // 1..31
  }
  income: {
    salary: number
    additional: Array<{
      id: string
      title: string
      amount: number
    }>
  }
  obligations: Array<{
    id: string
    title: string
    amount: number
    paidAmount: number
    dueDate: string | null
    category: string | null
  }>
  goals: Array<{
    id: string
    title: string
    target: number
    saved: number
    monthlyAllocation: number
    contributedThisMonth: number
    deadline: string | null
    category: string | null
  }>
  budgets: Array<{
    id: string
    title: string
    limit: number
    spent: number
    kind: 'living' | 'wishes' | 'supermarket' | 'flexible' | 'other'
    // wishes مدعوم لاستقبال الحزم القديمة فقط، ويتجاهله رُشد.
  }>
  accounts: Array<{
    id: string
    title: string
    type: string
    balance: number | null
  }>
  transactions: Array<{
    id: string
    title: string
    amount: number
    category: string | null
    occurredAt: string // ISO 8601
  }>
}
```

## مثال كامل

```json
{
  "schema": "ratibi.rushd.finance",
  "version": 1,
  "exportedAt": "2026-07-27T12:00:00.000Z",
  "month": "2026-07",
  "currency": "SAR",
  "profile": {
    "displayName": "مستخدم راتبي",
    "salaryDay": 27
  },
  "income": {
    "salary": 12000,
    "additional": [
      {
        "id": "freelance",
        "title": "دخل إضافي",
        "amount": 1200
      }
    ]
  },
  "obligations": [
    {
      "id": "rent",
      "title": "الإيجار",
      "amount": 2166,
      "paidAmount": 2166,
      "dueDate": "2026-07-27T00:00:00.000Z",
      "category": "السكن"
    }
  ],
  "goals": [
    {
      "id": "emergency",
      "title": "صندوق الطوارئ",
      "target": 30000,
      "saved": 12000,
      "monthlyAllocation": 1000,
      "contributedThisMonth": 1000,
      "deadline": null,
      "category": "الأمان المالي"
    }
  ],
  "budgets": [
    {
      "id": "living",
      "title": "المصاريف اليومية",
      "limit": 2500,
      "spent": 875,
      "kind": "living"
    }
  ],
  "accounts": [
    {
      "id": "salary-account",
      "title": "حساب الراتب",
      "type": "جاري",
      "balance": null
    }
  ],
  "transactions": [
    {
      "id": "tx-1",
      "title": "مقاضي",
      "amount": 125.75,
      "category": "المصاريف اليومية",
      "occurredAt": "2026-07-27T09:30:00.000Z"
    }
  ]
}
```

## قواعد التطابق

- كل القيم المالية أرقام موجبة أو صفر، وليست نصوصًا منسقة.
- الراتب يجب أن يكون أكبر من صفر.
- `paidAmount` لا يتجاوز `amount`.
- `saved` لا يتجاوز `target`.
- الحقول غير الموجودة في «راتبي» ترسل بقيمة `null` أو قائمة فارغة؛ لا تُحذف المفاتيح الأساسية.
- ميزانية «أماني رُشد» تُحدد وتحفظ من صفحة الأماني داخل رُشد، ولا تأتي من «راتبي».
- `budgets.kind = "wishes"` مقبول مؤقتًا للتوافق مع الحزم القديمة، لكن رُشد يتجاهله ولا يعرضه ضمن حساب الشهر.
- `budgets.kind = "supermarket"` يظهر في الملخص المالي الخاص فقط، ولا يغيّر ميزانية السوبرماركت العائلية تلقائيًا.
- الحد الأقصى لكل قائمة 200 عنصر.
- لا تُرسل كلمات المرور، البريد، Firebase tokens، PIN، API keys، أرقام البطاقات، أرقام الحسابات أو IBAN.
- `exportedAt` يتغير فقط عندما يبني «راتبي» نسخة جديدة؛ يستخدمه «رُشد» لمنع إعادة استيراد النسخة نفسها.
- عند عدم وجود اتصال، يحتفظ «راتبي» ببياناته محليًا ويحاول Firebase إرسال الكتابة المعلقة عند عودة الاتصال.
