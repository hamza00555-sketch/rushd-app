import type { BudgetCategory, CategoryTone } from './financialEngine'

export const RATIBI_SCHEMA = 'ratibi.rushd.finance'
export const RATIBI_SCHEMA_VERSION = 1

const MAX_ITEMS_PER_SECTION = 200
const MAX_TEXT_LENGTH = 160

export type RatibiAdditionalIncome = {
  id: string
  title: string
  amount: number
}

export type RatibiObligation = {
  id: string
  title: string
  amount: number
  paidAmount: number
  dueDate: string | null
  category: string | null
}

export type RatibiGoal = {
  id: string
  title: string
  target: number
  saved: number
  monthlyAllocation: number
  contributedThisMonth: number
  deadline: string | null
  category: string | null
}

export type RatibiBudgetKind = 'living' | 'wishes' | 'supermarket' | 'flexible' | 'other'

export type RatibiBudget = {
  id: string
  title: string
  limit: number
  spent: number
  kind: RatibiBudgetKind
}

export type RatibiAccount = {
  id: string
  title: string
  type: string
  balance: number | null
}

export type RatibiTransaction = {
  id: string
  title: string
  amount: number
  category: string | null
  occurredAt: string
}

export type RatibiFinanceBundleV1 = {
  schema: typeof RATIBI_SCHEMA
  version: typeof RATIBI_SCHEMA_VERSION
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

export class RatibiImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RatibiImportError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const record = (value: unknown, label: string) => {
  if (!isRecord(value)) throw new RatibiImportError(`قسم «${label}» غير موجود أو غير صالح.`)
  return value
}

const text = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value.trim().slice(0, MAX_TEXT_LENGTH) : fallback

const requiredText = (value: unknown, label: string) => {
  const normalized = text(value)
  if (!normalized) throw new RatibiImportError(`الحقل «${label}» ناقص في بيانات راتبي.`)
  return normalized
}

const money = (value: unknown, label: string, allowZero = true) => {
  const normalized = typeof value === 'number' ? value : Number.NaN
  if (!Number.isFinite(normalized) || normalized < 0 || (!allowZero && normalized <= 0)) {
    throw new RatibiImportError(`قيمة «${label}» غير صحيحة.`)
  }
  return Math.round(normalized * 100) / 100
}

const nullableText = (value: unknown) => {
  const normalized = text(value)
  return normalized || null
}

const identifier = (value: unknown, fallback: string) => {
  const normalized = text(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

const list = (value: unknown, label: string) => {
  if (value == null) return []
  if (!Array.isArray(value)) throw new RatibiImportError(`قسم «${label}» يجب أن يكون قائمة.`)
  if (value.length > MAX_ITEMS_PER_SECTION) {
    throw new RatibiImportError(`قسم «${label}» أكبر من الحد المدعوم (${MAX_ITEMS_PER_SECTION} عنصر).`)
  }
  return value
}

const optionalDate = (value: unknown, label: string) => {
  const normalized = nullableText(value)
  if (!normalized) return null
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) throw new RatibiImportError(`تاريخ «${label}» غير صالح.`)
  return parsed.toISOString()
}

const requiredDate = (value: unknown, label: string) => {
  const normalized = requiredText(value, label)
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) throw new RatibiImportError(`تاريخ «${label}» غير صالح.`)
  return parsed.toISOString()
}

const parseJson = (input: string) => {
  const normalized = input.trim()
  if (!normalized) throw new RatibiImportError('الحافظة فارغة. انسخ البيانات من تطبيق راتبي أولًا.')
  try {
    return JSON.parse(normalized) as unknown
  } catch {
    throw new RatibiImportError('المحتوى المنسوخ ليس ملف JSON صالحًا من تطبيق راتبي.')
  }
}

export const parseRatibiBundle = (input: string | unknown): RatibiFinanceBundleV1 => {
  const root = record(typeof input === 'string' ? parseJson(input) : input, 'الملف')
  if (root.schema !== RATIBI_SCHEMA || root.version !== RATIBI_SCHEMA_VERSION) {
    throw new RatibiImportError('إصدار بيانات راتبي غير مدعوم. حدّث التطبيقين ثم أعد التصدير.')
  }

  const month = requiredText(root.month, 'الشهر')
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new RatibiImportError('الشهر يجب أن يكون بصيغة YYYY-MM.')
  }
  if (root.currency !== 'SAR') {
    throw new RatibiImportError('رُشد يدعم حاليًا الحزم المالية بالريال السعودي فقط.')
  }

  const profile = record(root.profile ?? {}, 'الملف الشخصي')
  const income = record(root.income, 'الدخل')
  const salary = money(income.salary, 'الراتب', false)
  const salaryDayValue = profile.salaryDay == null ? null : Number(profile.salaryDay)
  const salaryDay = salaryDayValue != null && Number.isInteger(salaryDayValue) && salaryDayValue >= 1 && salaryDayValue <= 31
    ? salaryDayValue
    : null

  const additional = list(income.additional, 'الدخل الإضافي').map((item, index) => {
    const row = record(item, `الدخل الإضافي ${index + 1}`)
    return {
      id: identifier(row.id, `income-${index + 1}`),
      title: requiredText(row.title, `اسم الدخل الإضافي ${index + 1}`),
      amount: money(row.amount, `مبلغ الدخل الإضافي ${index + 1}`),
    }
  })

  const obligations = list(root.obligations, 'الالتزامات').map((item, index) => {
    const row = record(item, `الالتزام ${index + 1}`)
    const amount = money(row.amount, `مبلغ الالتزام ${index + 1}`)
    const paidAmount = money(row.paidAmount ?? 0, `المدفوع للالتزام ${index + 1}`)
    if (paidAmount > amount) {
      throw new RatibiImportError(`المدفوع للالتزام ${index + 1} أكبر من قيمته.`)
    }
    return {
      id: identifier(row.id, `obligation-${index + 1}`),
      title: requiredText(row.title, `اسم الالتزام ${index + 1}`),
      amount,
      paidAmount,
      dueDate: optionalDate(row.dueDate, `موعد الالتزام ${index + 1}`),
      category: nullableText(row.category),
    }
  })

  const goals = list(root.goals, 'الأهداف').map((item, index) => {
    const row = record(item, `الهدف ${index + 1}`)
    const target = money(row.target, `قيمة الهدف ${index + 1}`)
    const saved = money(row.saved ?? 0, `المحفوظ للهدف ${index + 1}`)
    if (saved > target) {
      throw new RatibiImportError(`المحفوظ للهدف ${index + 1} أكبر من قيمته المستهدفة.`)
    }
    return {
      id: identifier(row.id, `goal-${index + 1}`),
      title: requiredText(row.title, `اسم الهدف ${index + 1}`),
      target,
      saved,
      monthlyAllocation: money(row.monthlyAllocation ?? 0, `مخصص الهدف ${index + 1}`),
      contributedThisMonth: money(row.contributedThisMonth ?? 0, `مساهمة الهدف ${index + 1}`),
      deadline: optionalDate(row.deadline, `موعد الهدف ${index + 1}`),
      category: nullableText(row.category),
    }
  })

  const validBudgetKinds: RatibiBudgetKind[] = ['living', 'wishes', 'supermarket', 'flexible', 'other']
  const budgets = list(root.budgets, 'الميزانيات').map((item, index) => {
    const row = record(item, `الميزانية ${index + 1}`)
    const kind = validBudgetKinds.includes(row.kind as RatibiBudgetKind) ? row.kind as RatibiBudgetKind : 'other'
    return {
      id: identifier(row.id, `budget-${index + 1}`),
      title: requiredText(row.title, `اسم الميزانية ${index + 1}`),
      limit: money(row.limit, `مبلغ الميزانية ${index + 1}`),
      spent: money(row.spent ?? 0, `مصروف الميزانية ${index + 1}`),
      kind,
    }
  })

  const accounts = list(root.accounts, 'الحسابات').map((item, index) => {
    const row = record(item, `الحساب ${index + 1}`)
    return {
      id: identifier(row.id, `account-${index + 1}`),
      title: requiredText(row.title, `اسم الحساب ${index + 1}`),
      type: text(row.type, 'حساب'),
      balance: row.balance == null ? null : money(row.balance, `رصيد الحساب ${index + 1}`),
    }
  })

  const transactions = list(root.transactions, 'الحركات').map((item, index) => {
    const row = record(item, `الحركة ${index + 1}`)
    return {
      id: identifier(row.id, `transaction-${index + 1}`),
      title: requiredText(row.title, `اسم الحركة ${index + 1}`),
      amount: money(row.amount, `مبلغ الحركة ${index + 1}`),
      category: nullableText(row.category),
      occurredAt: requiredDate(row.occurredAt, `تاريخ الحركة ${index + 1}`),
    }
  })

  return {
    schema: RATIBI_SCHEMA,
    version: RATIBI_SCHEMA_VERSION,
    exportedAt: requiredDate(root.exportedAt, 'وقت التصدير'),
    month,
    currency: 'SAR',
    profile: {
      displayName: nullableText(profile.displayName),
      salaryDay,
    },
    income: { salary, additional },
    obligations,
    goals,
    budgets,
    accounts,
    transactions,
  }
}

export const getRatibiIncomeTotal = (bundle: RatibiFinanceBundleV1) =>
  bundle.income.salary + bundle.income.additional.reduce((total, item) => total + item.amount, 0)

const categoryTone = (index: number): CategoryTone =>
  (['violet', 'lavender', 'apricot', 'coral'] as const)[index % 4]

export const buildRatibiCategories = (bundle: RatibiFinanceBundleV1): BudgetCategory[] => {
  const categories: BudgetCategory[] = []
  const obligationsLimit = bundle.obligations.reduce((total, item) => total + item.amount, 0)
  const obligationsSpent = bundle.obligations.reduce((total, item) => total + item.paidAmount, 0)
  const goalsLimit = bundle.goals.reduce((total, item) => total + item.monthlyAllocation, 0)
  const goalsSpent = bundle.goals.reduce((total, item) => total + item.contributedThisMonth, 0)

  if (obligationsLimit > 0 || obligationsSpent > 0) {
    categories.push({
      id: 'commitments',
      title: 'الالتزامات',
      icon: '📌',
      limit: obligationsLimit,
      spent: obligationsSpent,
      tone: 'lavender',
    })
  }

  if (goalsLimit > 0 || goalsSpent > 0) {
    categories.push({
      id: 'future',
      title: 'الأهداف والادخار',
      icon: '🛡️',
      limit: goalsLimit,
      spent: goalsSpent,
      tone: 'apricot',
    })
  }

  const usedIds = new Set(categories.map((category) => category.id))
  bundle.budgets.forEach((budget, index) => {
    let id = budget.kind === 'wishes'
      ? 'wishes'
      : budget.kind === 'supermarket'
        ? 'supermarket'
        : `ratibi-${budget.id}`
    while (usedIds.has(id)) id = `${id}-${index + 1}`
    usedIds.add(id)
    categories.push({
      id,
      title: budget.title,
      icon: budget.kind === 'wishes' ? '♡' : budget.kind === 'supermarket' ? '🛒' : '•',
      limit: budget.limit,
      spent: budget.spent,
      tone: categoryTone(index),
    })
  })

  if (categories.length === 0) {
    categories.push({
      id: 'available',
      title: 'المتاح للتوزيع',
      icon: '•',
      limit: getRatibiIncomeTotal(bundle),
      spent: 0,
      tone: 'violet',
    })
  }

  return categories
}

export const getRatibiWishesBudget = (bundle: RatibiFinanceBundleV1 | null) =>
  bundle?.budgets.find((budget) => budget.kind === 'wishes') ?? null
