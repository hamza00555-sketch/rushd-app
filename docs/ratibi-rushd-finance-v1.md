# Ratibi → Rushd Finance Bundle v1

هذه هي صيغة التبادل الرسمية بين تطبيق «راتبي» وتطبيق «رُشد». «راتبي» هو مصدر الإدخال، و«رُشد» يستورد نسخة شهرية للعرض والتحليل ويحفظها في حساب المستخدم الخاص على Firebase.

## النقل

1. يبني «راتبي» الكائن الموضح أدناه من بيانات الشهر المفتوح.
2. يحوّله باستخدام `JSON.stringify(bundle)`.
3. ينسخه إلى الحافظة بعد ضغط المستخدم زر «إرسال إلى رُشد».
4. يفتح المستخدم «رُشد» ويضغط «استيراد البيانات من راتبي».
5. يتحقق «رُشد» من المخطط والإصدار والشهر والقيم قبل الحفظ.

ممنوع وضع الحزمة في Query String أو URL، وممنوع تسجيلها في `console` أو analytics.

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
      "id": "wishes",
      "title": "أماني رُشد",
      "limit": 500,
      "spent": 100,
      "kind": "wishes"
    },
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
- `budgets.kind = "wishes"` هو المصدر الرسمي لميزانية «أماني رُشد».
- `budgets.kind = "supermarket"` يظهر في الملخص المالي الخاص فقط، ولا يغيّر ميزانية السوبرماركت العائلية تلقائيًا.
- الحد الأقصى لكل قائمة 200 عنصر.
