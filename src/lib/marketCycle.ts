import { ARABIC_GREGORIAN_LOCALE } from './locale'

export const MIN_MARKET_CYCLE_START_DAY = 1
export const MAX_MARKET_CYCLE_START_DAY = 28

const DAY_IN_MS = 24 * 60 * 60 * 1000
const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/

export type MarketBudgetLedgerEntry = {
  monthKey: string
  amount: number
  updatedByName: string
  updatedAtLabel: string
}

export type MarketExpenseLedgerEntry = {
  monthKey: string
  amount: number
}

export type MarketRollingBudget = {
  monthKey: string
  amount: number
  monthlyAmount: number
  carryoverAmount: number
  sourceMonthKey: string
  inherited: boolean
  updatedByName: string
  updatedAtLabel: string
}

const toMonthKey = (year: number, monthIndex: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}`

const parseMonthKey = (monthKey: string) => {
  const match = MONTH_KEY_PATTERN.exec(monthKey)
  if (!match) throw new Error('دورة السوبرماركت غير صالحة.')
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  if (monthIndex < 0 || monthIndex > 11) throw new Error('دورة السوبرماركت غير صالحة.')
  return { year, monthIndex }
}

const toMonthSerial = (monthKey: string) => {
  const { year, monthIndex } = parseMonthKey(monthKey)
  return year * 12 + monthIndex
}

const tryMonthSerial = (monthKey: string) => {
  try {
    return toMonthSerial(monthKey)
  } catch {
    return null
  }
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export const resolveMarketRollingBudget = (
  monthKey: string,
  budgetEntries: MarketBudgetLedgerEntry[],
  expenseEntries: MarketExpenseLedgerEntry[],
): MarketRollingBudget | null => {
  const targetSerial = toMonthSerial(monthKey)
  const budgetsByMonth = new Map<number, MarketBudgetLedgerEntry>()

  budgetEntries.forEach((entry) => {
    const serial = tryMonthSerial(entry.monthKey)
    if (serial === null || !Number.isFinite(entry.amount) || entry.amount <= 0 || serial > targetSerial) return
    budgetsByMonth.set(serial, entry)
  })

  const budgetMonths = [...budgetsByMonth.keys()].sort((a, b) => a - b)
  if (budgetMonths.length === 0) return null

  const expensesByMonth = new Map<number, number>()
  expenseEntries.forEach((entry) => {
    const serial = tryMonthSerial(entry.monthKey)
    if (serial === null || !Number.isFinite(entry.amount) || entry.amount <= 0 || serial > targetSerial) return
    expensesByMonth.set(serial, roundMoney((expensesByMonth.get(serial) ?? 0) + entry.amount))
  })

  let monthlyAmount = 0
  let previousRemaining = 0
  let source = budgetsByMonth.get(budgetMonths[0])!

  for (let serial = budgetMonths[0]; serial <= targetSerial; serial += 1) {
    const explicitBudget = budgetsByMonth.get(serial)
    if (explicitBudget) {
      monthlyAmount = roundMoney(explicitBudget.amount)
      source = explicitBudget
    }

    const carryoverAmount = serial === budgetMonths[0]
      ? 0
      : roundMoney(Math.max(0, previousRemaining))
    const amount = roundMoney(monthlyAmount + carryoverAmount)
    previousRemaining = roundMoney(amount - (expensesByMonth.get(serial) ?? 0))

    if (serial === targetSerial) {
      return {
        monthKey,
        amount,
        monthlyAmount,
        carryoverAmount,
        sourceMonthKey: source.monthKey,
        inherited: !explicitBudget,
        updatedByName: source.updatedByName,
        updatedAtLabel: source.updatedAtLabel,
      }
    }
  }

  return null
}

const daySerial = (date: Date) =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())

export const normalizeMarketCycleStartDay = (value: unknown) => {
  const day = Number(value)
  if (!Number.isInteger(day)) return MIN_MARKET_CYCLE_START_DAY
  return Math.min(MAX_MARKET_CYCLE_START_DAY, Math.max(MIN_MARKET_CYCLE_START_DAY, day))
}

export const getActiveMarketCycleKey = (
  startDayInput: number,
  now = new Date(),
) => {
  const startDay = normalizeMarketCycleStartDay(startDayInput)
  const activeMonth = now.getDate() >= startDay
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return toMonthKey(activeMonth.getFullYear(), activeMonth.getMonth())
}

export const getMarketCycleRange = (
  monthKey: string,
  startDayInput: number,
) => {
  const { year, monthIndex } = parseMonthKey(monthKey)
  const startDay = normalizeMarketCycleStartDay(startDayInput)
  const start = new Date(year, monthIndex, startDay)
  const endExclusive = new Date(year, monthIndex + 1, startDay)
  const end = new Date(year, monthIndex + 1, startDay - 1)
  return { start, end, endExclusive }
}

export const getMarketCycleSummary = (
  monthKey: string,
  startDayInput: number,
  now = new Date(),
) => {
  const startDay = normalizeMarketCycleStartDay(startDayInput)
  const range = getMarketCycleRange(monthKey, startDay)
  const isCurrent = getActiveMarketCycleKey(startDay, now) === monthKey
  const daysRemaining = isCurrent
    ? Math.max(0, Math.ceil((daySerial(range.endExclusive) - daySerial(now)) / DAY_IN_MS))
    : null
  const dateFormatter = new Intl.DateTimeFormat(ARABIC_GREGORIAN_LOCALE, {
    day: 'numeric',
    month: 'short',
  })

  return {
    ...range,
    isCurrent,
    daysRemaining,
    label: `${dateFormatter.format(range.start)} – ${dateFormatter.format(range.end)}`,
    endLabel: dateFormatter.format(range.end),
  }
}
