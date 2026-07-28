import { ARABIC_GREGORIAN_LOCALE } from './locale'

export const MIN_MARKET_CYCLE_START_DAY = 1
export const MAX_MARKET_CYCLE_START_DAY = 28

const DAY_IN_MS = 24 * 60 * 60 * 1000
const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/

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
