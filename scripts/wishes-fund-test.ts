import { strict as assert } from 'node:assert'
import {
  distributeWishesFund,
  getProjectedMonthlyWishShare,
  getWishCompletionForecast,
  normalizeWishNeedPercent,
  roundMoney,
} from '../src/lib/wishesFund'

const calmDistribution = distributeWishesFund(1000, [
  { id: 'urgent', target: 2000, saved: 0, needPercent: 10 },
  { id: 'important', target: 2000, saved: 0, needPercent: 5 },
  { id: 'later', target: 2000, saved: 0, needPercent: 1 },
])

assert.deepEqual(calmDistribution.allocations, {
  urgent: 100,
  important: 50,
  later: 10,
})
assert.equal(calmDistribution.allocatedAmount, 160)
assert.equal(calmDistribution.reserveAmount, 840)

const cappedDistribution = distributeWishesFund(1000, [
  { id: 'almost-ready', target: 95, saved: 90, needPercent: 10 },
  { id: 'later', target: 1000, saved: 0, needPercent: 1 },
])
assert.equal(cappedDistribution.allocations['almost-ready'], 5)
assert.equal(cappedDistribution.allocations.later, 10)
assert.equal(cappedDistribution.reserveAmount, 985)

const crowdedDistribution = distributeWishesFund(
  1000,
  Array.from({ length: 11 }, (_, index) => ({
    id: `wish-${index}`,
    target: 5000,
    saved: 0,
    needPercent: 10,
  })),
)
assert.equal(crowdedDistribution.allocatedAmount, 1000)
assert.equal(crowdedDistribution.reserveAmount, 0)
assert.equal(
  roundMoney(Object.values(crowdedDistribution.allocations).reduce((sum, amount) => sum + amount, 0)),
  1000,
)

assert.equal(getProjectedMonthlyWishShare(1000, 10, 50), 100)
assert.equal(getProjectedMonthlyWishShare(1000, 10, 200), 50)
assert.equal(normalizeWishNeedPercent(5), 5)
assert.equal(normalizeWishNeedPercent(7), 3)

const forecast = getWishCompletionForecast({
  target: 1000,
  saved: 400,
  monthlyFundAmount: 1000,
  needPercent: 10,
  activeNeedPercentTotal: 50,
  monthKey: '2026-07',
})
assert.equal(forecast?.monthlyShare, 100)
assert.equal(forecast?.monthsRemaining, 6)
assert.match(forecast?.label ?? '', /2027|٢٠٢٧/)

process.stdout.write('Wishes fund tests passed.\n')
