import { strict as assert } from 'node:assert'
import {
  RATIBI_SCHEMA,
  RatibiImportError,
  buildRatibiCategories,
  getRatibiIncomeTotal,
  getRatibiWishesBudget,
  parseRatibiBundle,
} from '../src/lib/ratibiImport'

const validBundle = {
  schema: RATIBI_SCHEMA,
  version: 1,
  exportedAt: '2026-07-27T12:00:00.000Z',
  month: '2026-07',
  currency: 'SAR',
  profile: { displayName: 'مستخدم تجريبي', salaryDay: 27 },
  income: {
    salary: 12000,
    additional: [{ id: 'bonus', title: 'دخل إضافي', amount: 1000 }],
  },
  obligations: [{
    id: 'rent',
    title: 'الإيجار',
    amount: 2166,
    paidAmount: 2166,
    dueDate: '2026-07-27T00:00:00.000Z',
    category: 'السكن',
  }],
  goals: [{
    id: 'emergency',
    title: 'الطوارئ',
    target: 30000,
    saved: 12000,
    monthlyAllocation: 1000,
    contributedThisMonth: 1000,
    deadline: null,
    category: 'الأمان',
  }],
  budgets: [{
    id: 'wishes',
    title: 'أماني رُشد',
    limit: 500,
    spent: 100,
    kind: 'wishes',
  }],
  accounts: [{ id: 'salary', title: 'حساب الراتب', type: 'جاري', balance: null }],
  transactions: [{
    id: 'tx-1',
    title: 'مقاضي',
    amount: 125.75,
    category: 'يومي',
    occurredAt: '2026-07-27T09:30:00.000Z',
  }],
}

const parsed = parseRatibiBundle(JSON.stringify(validBundle))
assert.equal(parsed.month, '2026-07')
assert.equal(getRatibiIncomeTotal(parsed), 13000)
assert.equal(getRatibiWishesBudget(parsed)?.limit, 500)
assert.deepEqual(buildRatibiCategories(parsed).map((category) => category.id), [
  'commitments',
  'future',
  'wishes',
])

assert.throws(
  () => parseRatibiBundle({ ...validBundle, schema: 'unknown.schema' }),
  RatibiImportError,
)
assert.throws(
  () => parseRatibiBundle({ ...validBundle, month: '07-2026' }),
  /الشهر يجب أن يكون/,
)
assert.throws(
  () => parseRatibiBundle({
    ...validBundle,
    obligations: [{ ...validBundle.obligations[0], paidAmount: 3000 }],
  }),
  /أكبر من قيمته/,
)
assert.throws(
  () => parseRatibiBundle({
    ...validBundle,
    goals: [{ ...validBundle.goals[0], saved: 40000 }],
  }),
  /أكبر من قيمته المستهدفة/,
)

process.stdout.write('Ratibi import tests passed.\n')
