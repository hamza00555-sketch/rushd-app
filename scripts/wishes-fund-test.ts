import { strict as assert } from 'node:assert'
import {
  appendWishFundContribution,
  distributeWishesFund,
  getProjectedMonthlyWishShare,
  getWishCompletionForecast,
  getWishFundingCapacityError,
  resolveWishFundingPortfolio,
  roundMoney,
} from '../src/lib/wishesFund'

const balancedDistribution = distributeWishesFund(1000, [
  { id: 'primary', target: 5000, saved: 0, fundingLevel: 'primary' },
  { id: 'medium', target: 5000, saved: 0, fundingLevel: 'medium' },
  { id: 'calm', target: 5000, saved: 0, fundingLevel: 'calm' },
])
assert.deepEqual(balancedDistribution.allocations, {
  primary: 600,
  medium: 300,
  calm: 100,
})
assert.equal(balancedDistribution.allocatedAmount, 1000)
assert.equal(balancedDistribution.reserveAmount, 0)

const calmDistribution = distributeWishesFund(1000, [
  { id: 'calm-1', target: 5000, saved: 0, fundingLevel: 'calm' },
  { id: 'calm-2', target: 5000, saved: 0, fundingLevel: 'calm' },
  { id: 'calm-3', target: 5000, saved: 0, fundingLevel: 'calm' },
])
assert.deepEqual(calmDistribution.allocations, {
  'calm-1': 100,
  'calm-2': 100,
  'calm-3': 100,
})
assert.equal(calmDistribution.reserveAmount, 700)

const crowdedDistribution = distributeWishesFund(1000, [
  { id: 'primary', target: 5000, saved: 0, fundingLevel: 'primary' },
  { id: 'medium-1', target: 5000, saved: 0, fundingLevel: 'medium' },
  { id: 'medium-2', target: 5000, saved: 0, fundingLevel: 'medium' },
])
assert.deepEqual(crowdedDistribution.allocations, {
  primary: 500,
  'medium-1': 250,
  'medium-2': 250,
})
assert.equal(crowdedDistribution.allocatedAmount, 1000)
assert.equal(crowdedDistribution.reserveAmount, 0)

const appendedLedger = appendWishFundContribution({
  amount: 1000,
  allocations: { primary: 600, calm: 100 },
  reserveAmount: 300,
}, 500, {
  allocations: { primary: 300, medium: 150 },
  allocatedAmount: 450,
  reserveAmount: 50,
  scale: 1,
})
assert.deepEqual(appendedLedger, {
  amount: 1500,
  allocations: { primary: 900, calm: 100, medium: 150 },
  allocatedAmount: 1150,
  reserveAmount: 350,
})

const cappedDistribution = distributeWishesFund(1000, [
  { id: 'almost-ready', target: 95, saved: 90, fundingLevel: 'primary' },
  { id: 'later', target: 1000, saved: 0, fundingLevel: 'calm' },
  { id: 'paused', target: 1000, saved: 0, fundingLevel: 'paused' },
])
assert.equal(cappedDistribution.allocations['almost-ready'], 5)
assert.equal(cappedDistribution.allocations.later, 100)
assert.equal(cappedDistribution.allocations.paused, undefined)
assert.equal(cappedDistribution.reserveAmount, 895)

const migratedPortfolio = resolveWishFundingPortfolio([
  { id: 'legacy-high-1', legacyNeedPercent: 10 },
  { id: 'legacy-high-2', legacyNeedPercent: 5 },
  { id: 'legacy-normal', legacyNeedPercent: 3 },
  { id: 'legacy-extra', legacyNeedPercent: 1 },
])
assert.deepEqual(migratedPortfolio, {
  'legacy-high-1': 'primary',
  'legacy-high-2': 'medium',
  'legacy-normal': 'medium',
  'legacy-extra': 'paused',
})

const portfolio = [
  { id: 'primary', fundingLevel: 'primary' as const },
  { id: 'medium-1', fundingLevel: 'medium' as const },
  { id: 'calm', fundingLevel: 'calm' as const },
]
assert.match(getWishFundingCapacityError(portfolio, 'calm', 'primary'), /واحدة/)
assert.equal(getWishFundingCapacityError(portfolio, 'primary', 'paused'), '')
assert.match(getWishFundingCapacityError(portfolio, 'new', 'calm'), /3 أماني/)

assert.equal(getProjectedMonthlyWishShare(1000, 'primary', 100), 600)
assert.equal(getProjectedMonthlyWishShare(1000, 'primary', 120), 500)

const forecast = getWishCompletionForecast({
  target: 1000,
  saved: 400,
  monthlyFundAmount: 1000,
  fundingLevel: 'medium',
  activeShareTotal: 100,
  monthKey: '2026-07',
})
assert.equal(forecast?.monthlyShare, 300)
assert.equal(forecast?.monthsRemaining, 2)
assert.match(forecast?.label ?? '', /2026|٢٠٢٦/)

assert.equal(roundMoney(10.005), 10.01)
process.stdout.write('Wishes fund tests passed.\n')
