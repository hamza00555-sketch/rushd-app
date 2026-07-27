# Prompt كامل لكلود — ربط تطبيق «راتبي» مع «رُشد»

أنت مسؤول عن تعديل تطبيق «راتبي» الموجود في المستودع الحالي وتنفيذ ربط تصدير فعلي إلى تطبيق «رُشد». لا تعطِني خطة أو اقتراحات عامة؛ افحص الكود ونماذج البيانات الحالية وطبّق التعديل كاملًا، ثم شغّل اختبارات TypeScript والبناء واختبارات المشروع الموجودة.

## الهدف

«راتبي» هو المصدر الوحيد لإدخال وإدارة المعلومات المالية: الراتب، الدخل الإضافي، الالتزامات، الأهداف، الميزانيات، الحسابات والحركات. «رُشد» لا يطلب من المستخدم إعادة إدخال هذه المعلومات؛ وظيفته استيراد نسخة شهرية من «راتبي» وعرضها وتحليلها بصورة مرتبة.

أضف في «راتبي» زرًا واضحًا باسم:

**إرسال إلى رُشد**

عند ضغط المستخدم عليه:

1. اجمع بيانات الشهر المفتوح حاليًا من مخزن «راتبي» الحقيقي.
2. حوّلها إلى المخطط `RatibiFinanceBundleV1` المحدد أدناه.
3. تحقّق من القيم قبل التصدير.
4. نفّذ `JSON.stringify(bundle)`.
5. انسخ النص الناتج إلى الحافظة باستخدام `navigator.clipboard.writeText` داخل نفس ضغطة المستخدم.
6. اعرض رسالة نجاح عربية واضحة:  
   **تم نسخ بيانات الشهر. افتح رُشد واضغط «استيراد البيانات من راتبي».**
7. إذا لم تسمح المنصة بالنسخ إلى الحافظة، استخدم fallback مناسبًا للجوال:
   - جرّب Web Share API بنص الحزمة إذا كان مدعومًا.
   - وإلا افتح Bottom Sheet يحتوي النص كاملًا داخل حقل `readonly` مع زر «نسخ».

لا تضف API أو Backend أو Firebase أو Supabase لهذا الربط. بيانات «راتبي» تبقى في IndexedDB كما هي، والنقل يتم فقط بعد طلب المستخدم.

## ممنوعات أمنية

- ممنوع وضع JSON داخل Query String أو URL.
- ممنوع وضع البيانات في `localStorage` كوسيط جديد.
- ممنوع طباعة الحزمة أو الراتب أو البريد أو الحسابات في `console`.
- ممنوع إرسال الحزمة إلى analytics أو error tracking.
- ممنوع تصدير البريد، كلمات المرور، Firebase tokens، session tokens، أرقام البطاقات، أرقام الحسابات البنكية أو IBAN.
- `accounts.id` هو المعرّف الداخلي الموجود في التطبيق فقط، وليس رقم الحساب البنكي.
- لا تقرأ الحافظة تلقائيًا ولا تصدّر تلقائيًا؛ العملية تبدأ فقط بعد ضغط المستخدم.

## المخطط الإجباري

استخدم الأنواع التالية حرفيًا من ناحية أسماء المفاتيح:

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
  | 'wishes'
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

## قواعد بناء الحزمة

- `schema` يساوي دائمًا `ratibi.rushd.finance`.
- `version` يساوي دائمًا الرقم `1`.
- `exportedAt` يساوي `new Date().toISOString()`.
- `month` بصيغة `YYYY-MM` ويطابق الشهر المفتوح في «راتبي».
- `currency` تساوي `SAR`.
- كل القيم المالية يجب أن تكون JavaScript numbers غير سالبة، وليست نصوصًا منسقة أو متبوعة بكلمة ريال.
- `income.salary` يجب أن يكون أكبر من صفر.
- `paidAmount` لا يتجاوز `amount`.
- `saved` لا يتجاوز `target`.
- التواريخ تكون ISO 8601 أو `null`.
- إذا لم توجد بيانات في قسم معيّن أرسل قائمة فارغة `[]`، ولا تحذف المفتاح.
- إذا لم توجد قيمة اختيارية أرسل `null`، وليس `undefined`.
- صدّر الحركات التابعة للشهر المفتوح فقط، وبحد أقصى أحدث 200 حركة.
- الحد الأقصى لكل واحدة من القوائم الأخرى 200 عنصر. إذا تجاوزت البيانات الحد اعرض رسالة واضحة بدل القطع الصامت.
- استخدم المعرفات الحالية من «راتبي». إذا كان عنصر قديم بلا معرف، أنشئ له معرفًا ثابتًا وليس عشوائيًا يتغير مع كل تصدير.

## مطابقة بيانات «راتبي»

افحص نماذج البيانات الفعلية في المشروع ولا تفترض أسماء الحقول. أنشئ طبقة mapping واحدة معزولة، مثل:

```ts
buildRushdFinanceBundle(currentMonthData): RatibiFinanceBundleV1
```

هذه الدالة يجب أن تكون pure قدر الإمكان وقابلة للاختبار. لا تغيّر بنية IndexedDB الحالية فقط لتناسب التصدير.

المطابقة المطلوبة:

- الراتب الأساسي → `income.salary`
- أي دخل آخر في الشهر → `income.additional`
- التزامات الشهر، المدفوع والمتبقي → `obligations`
- الأهداف ومجموع المحفوظ والمخصص الشهري والمساهمة المنفذة هذا الشهر → `goals`
- ميزانيات المصروفات → `budgets`
- الحسابات البنكية/المحافظ المسماة داخل التطبيق → `accounts`
- حركات الشهر → `transactions`

بالنسبة للميزانيات:

- ميزانية الأماني يجب أن تُرسل كعنصر `budgets` مع `kind: 'wishes'`.
- ميزانية السوبرماركت إن كانت موجودة تُرسل مع `kind: 'supermarket'`.
- المصاريف اليومية أو المنزلية تستخدم `kind: 'living'`.
- الميزانية المرنة تستخدم `kind: 'flexible'`.
- أي ميزانية لا تنطبق عليها الأنواع السابقة تستخدم `kind: 'other'`.

إذا كانت ميزانية الأماني غير موجودة في «راتبي»، أضفها إلى نظام ميزانيات «راتبي» بنفس منطق الميزانيات الحالية، ولا تكتب رقمًا افتراضيًا للمستخدم. رُشد يعتمد `kind: 'wishes'` كمصدر رسمي لميزانية الأماني.

## مثال ناتج صحيح

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

## تجربة المستخدم

- التطبيق عربي RTL وMobile-first، والاختبار الأساسي على iPhone Safari.
- ضع زر «إرسال إلى رُشد» في مكان منطقي داخل ملخص الشهر أو قائمة إجراءات الشهر، وليس داخل إعدادات مخفية بعمق.
- الزر لا يغيّر أي بيانات مالية في «راتبي».
- أثناء تجهيز الحزمة يظهر loading قصير ويُمنع الضغط المتكرر.
- عند النجاح يظهر check واضح ورسالة النجاح.
- عند فشل التحقق اذكر القسم أو الحقل المتسبب بالعربية.
- لا تعرض JSON للمستخدم في المسار الطبيعي؛ اعرضه فقط في fallback النسخ اليدوي.
- أضف `aria-label` وحالة `aria-live` للنجاح أو الخطأ.

## الاختبارات المطلوبة

أضف اختبارات على الأقل للحالات التالية:

1. تصدير شهر كامل ينتج المخطط والإصدار الصحيحين.
2. الراتب والدخل الإضافي يبقيان أرقامًا صحيحة.
3. الالتزامات والأهداف والميزانيات تطابق بيانات IndexedDB الحالية.
4. ميزانية الأماني تخرج مع `kind: 'wishes'`.
5. الحقول الاختيارية تتحول إلى `null` وليس `undefined`.
6. عدم وجود بيانات ينتج قوائم فارغة.
7. البيانات غير الصالحة تمنع التصدير برسالة مفهومة.
8. لا يتم تصدير البريد أو tokens أو IBAN أو أرقام البطاقات.
9. مسار clipboard الناجح.
10. fallback عند فشل clipboard.

## شروط القبول

- الزر يعمل فعليًا من بيانات المستخدم الحالية، وليس Demo JSON ثابتًا.
- لا توجد أسماء أو رواتب أو أي بيانات شخصية مكتوبة مباشرة في الكود.
- لا يوجد API جديد ولا تكلفة تشغيل جديدة.
- لا تتعطل وظائف «راتبي» الحالية أو وضعه Offline.
- TypeScript strict ناجح.
- اختبارات المشروع ناجحة.
- Production build ناجح.
- لا توجد `console.error` جديدة.
- سلّمني ملخصًا بالملفات المعدلة وكيف تم ربط كل نموذج بيانات في «راتبي» بالمخطط، وأي حقل لم يكن موجودًا أصلًا وكيف تعاملت معه.
