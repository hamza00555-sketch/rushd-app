import { ARABIC_GREGORIAN_LOCALE } from './locale'

export const WISH_NEED_LEVELS = [
  { percent: 1, label: 'ننتظر وقته', description: 'غير مستعجل الآن' },
  { percent: 2, label: 'أولوية خفيفة', description: 'يتقدم بهدوء' },
  { percent: 3, label: 'احتياج عادي', description: 'له حصة متوازنة' },
  { percent: 5, label: 'مهم قريبًا', description: 'نسرّع الوصول له' },
  { percent: 10, label: 'أولوية الآن', description: 'أعلى حصة من كل دفعة' },
] as const

export type WishNeedPercent = typeof WISH_NEED_LEVELS[number]['percent']

export type WishDistributionInput = {
  id: string
  target: number
  saved: number
  needPercent: number
}

export type WishFundDistribution = {
  allocations: Record<string, number>
  allocatedAmount: number
  reserveAmount: number
  scale: number
}

const MONEY_PRECISION = 100

export const roundMoney = (value: number) =>
  Math.round((Number.isFinite(value) ? value : 0) * MONEY_PRECISION) / MONEY_PRECISION

export const normalizeWishNeedPercent = (value: unknown): WishNeedPercent => {
  const parsed = Number(value)
  const matched = WISH_NEED_LEVELS.find((level) => level.percent === parsed)
  return matched?.percent ?? 3
}

export const getWishNeedLevel = (value: unknown) => {
  const percent = normalizeWishNeedPercent(value)
  return WISH_NEED_LEVELS.find((level) => level.percent === percent) ?? WISH_NEED_LEVELS[2]
}

export const distributeWishesFund = (
  amountInput: number,
  wishes: WishDistributionInput[],
): WishFundDistribution => {
  const amount = Math.max(0, roundMoney(amountInput))
  const requested = wishes
    .map((wish) => {
      const remaining = Math.max(0, roundMoney(wish.target - wish.saved))
      const needPercent = normalizeWishNeedPercent(wish.needPercent)
      return {
        id: wish.id,
        requested: Math.min(remaining, amount * (needPercent / 100)),
      }
    })
    .filter((wish) => wish.requested > 0)

  const requestedTotal = requested.reduce((total, wish) => total + wish.requested, 0)
  const scale = requestedTotal > amount && requestedTotal > 0 ? amount / requestedTotal : 1
  const allocations: Record<string, number> = {}

  requested.forEach((wish) => {
    const allocation = roundMoney(wish.requested * scale)
    if (allocation > 0) allocations[wish.id] = allocation
  })

  let allocatedAmount = roundMoney(
    Object.values(allocations).reduce((total, allocation) => total + allocation, 0),
  )

  if (allocatedAmount > amount) {
    const lastWishId = Object.keys(allocations).at(-1)
    if (lastWishId) {
      allocations[lastWishId] = roundMoney(allocations[lastWishId] - (allocatedAmount - amount))
      allocatedAmount = roundMoney(
        Object.values(allocations).reduce((total, allocation) => total + allocation, 0),
      )
    }
  }

  return {
    allocations,
    allocatedAmount,
    reserveAmount: roundMoney(Math.max(0, amount - allocatedAmount)),
    scale,
  }
}

export const getProjectedMonthlyWishShare = (
  monthlyFundAmountInput: number,
  needPercentInput: number,
  activeNeedPercentTotal: number,
) => {
  const monthlyFundAmount = Math.max(0, roundMoney(monthlyFundAmountInput))
  const needPercent = normalizeWishNeedPercent(needPercentInput)
  const scale = activeNeedPercentTotal > 100 ? 100 / activeNeedPercentTotal : 1
  return roundMoney(monthlyFundAmount * (needPercent / 100) * scale)
}

export const getWishCompletionForecast = ({
  target,
  saved,
  monthlyFundAmount,
  needPercent,
  activeNeedPercentTotal,
  monthKey,
}: {
  target: number
  saved: number
  monthlyFundAmount: number
  needPercent: number
  activeNeedPercentTotal: number
  monthKey: string
}) => {
  const remaining = Math.max(0, roundMoney(target - saved))
  if (remaining === 0) {
    return {
      monthlyShare: 0,
      monthsRemaining: 0,
      label: 'جاهزة الآن',
    }
  }

  const monthlyShare = getProjectedMonthlyWishShare(
    monthlyFundAmount,
    needPercent,
    activeNeedPercentTotal,
  )
  if (monthlyShare <= 0 || !/^\d{4}-\d{2}$/.test(monthKey)) return null

  const [year, month] = monthKey.split('-').map(Number)
  if (month < 1 || month > 12) return null
  const monthsRemaining = Math.ceil(remaining / monthlyShare)
  const completionDate = new Date(year, month - 1 + monthsRemaining, 1)
  const label = new Intl.DateTimeFormat(ARABIC_GREGORIAN_LOCALE, {
    month: 'long',
    year: 'numeric',
  }).format(completionDate)

  return {
    monthlyShare,
    monthsRemaining,
    label,
  }
}
