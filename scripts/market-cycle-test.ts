import { strict as assert } from 'node:assert'
import {
  getActiveMarketCycleKey,
  getMarketCycleRange,
  getMarketCycleSummary,
  normalizeMarketCycleStartDay,
  resolveMarketRollingBudget,
} from '../src/lib/marketCycle'

const localDate = (year: number, monthIndex: number, day: number) =>
  new Date(year, monthIndex, day, 12, 0, 0)

assert.equal(getActiveMarketCycleKey(27, localDate(2026, 6, 28)), '2026-07')
assert.equal(getActiveMarketCycleKey(27, localDate(2026, 6, 10)), '2026-06')
assert.equal(getActiveMarketCycleKey(27, localDate(2026, 0, 5)), '2025-12')
assert.equal(getActiveMarketCycleKey(1, localDate(2026, 6, 1)), '2026-07')

const julyCycle = getMarketCycleRange('2026-07', 27)
assert.deepEqual(
  [
    julyCycle.start.getFullYear(),
    julyCycle.start.getMonth(),
    julyCycle.start.getDate(),
  ],
  [2026, 6, 27],
)
assert.deepEqual(
  [
    julyCycle.end.getFullYear(),
    julyCycle.end.getMonth(),
    julyCycle.end.getDate(),
  ],
  [2026, 7, 26],
)

const currentSummary = getMarketCycleSummary('2026-07', 27, localDate(2026, 6, 28))
assert.equal(currentSummary.isCurrent, true)
assert.equal(currentSummary.daysRemaining, 30)

const previousSummary = getMarketCycleSummary('2026-06', 27, localDate(2026, 6, 28))
assert.equal(previousSummary.isCurrent, false)
assert.equal(previousSummary.daysRemaining, null)

assert.equal(normalizeMarketCycleStartDay(27), 27)
assert.equal(normalizeMarketCycleStartDay(31), 28)
assert.equal(normalizeMarketCycleStartDay(0), 1)
assert.equal(normalizeMarketCycleStartDay('invalid'), 1)

const budgetEntry = (monthKey: string, amount: number) => ({
  monthKey,
  amount,
  updatedByName: 'Hamza',
  updatedAtLabel: 'now',
})

const julyRollingBudget = resolveMarketRollingBudget(
  '2026-07',
  [budgetEntry('2026-06', 1500)],
  [{ monthKey: '2026-06', amount: 1200 }],
)
assert.equal(julyRollingBudget?.monthlyAmount, 1500)
assert.equal(julyRollingBudget?.carryoverAmount, 300)
assert.equal(julyRollingBudget?.amount, 1800)
assert.equal(julyRollingBudget?.inherited, true)
assert.equal(julyRollingBudget?.sourceMonthKey, '2026-06')

const changedMonthlyBudget = resolveMarketRollingBudget(
  '2026-07',
  [budgetEntry('2026-06', 1500), budgetEntry('2026-07', 1700)],
  [{ monthKey: '2026-06', amount: 1200 }],
)
assert.equal(changedMonthlyBudget?.monthlyAmount, 1700)
assert.equal(changedMonthlyBudget?.carryoverAmount, 300)
assert.equal(changedMonthlyBudget?.amount, 2000)
assert.equal(changedMonthlyBudget?.inherited, false)

const accumulatedBudget = resolveMarketRollingBudget(
  '2026-08',
  [budgetEntry('2026-06', 1000)],
  [
    { monthKey: '2026-06', amount: 900 },
    { monthKey: '2026-07', amount: 400 },
  ],
)
assert.equal(accumulatedBudget?.monthlyAmount, 1000)
assert.equal(accumulatedBudget?.carryoverAmount, 700)
assert.equal(accumulatedBudget?.amount, 1700)

const noDebtCarryover = resolveMarketRollingBudget(
  '2026-07',
  [budgetEntry('2026-06', 1000)],
  [{ monthKey: '2026-06', amount: 1250 }],
)
assert.equal(noDebtCarryover?.carryoverAmount, 0)
assert.equal(noDebtCarryover?.amount, 1000)

assert.equal(resolveMarketRollingBudget('2026-07', [], []), null)

process.stdout.write('Market cycle tests passed.\n')
