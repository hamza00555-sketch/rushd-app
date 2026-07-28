import { strict as assert } from 'node:assert'
import {
  getActiveMarketCycleKey,
  getMarketCycleRange,
  getMarketCycleSummary,
  normalizeMarketCycleStartDay,
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

process.stdout.write('Market cycle tests passed.\n')
