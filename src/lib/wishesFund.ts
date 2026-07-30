import { ARABIC_GREGORIAN_LOCALE } from './locale'

export const WISH_FUNDING_LEVELS = [
  {
    id: 'primary',
    label: 'أساسية',
    description: 'أسرع أمنية الآن',
    share: 60,
    maxActive: 1,
  },
  {
    id: 'medium',
    label: 'متوسطة',
    description: 'مهمة لكن ليست الأولى',
    share: 30,
    maxActive: 2,
  },
  {
    id: 'calm',
    label: 'هادئة',
    description: 'تتقدم بدون استعجال',
    share: 10,
    maxActive: 3,
  },
  {
    id: 'paused',
    label: 'معلّقة',
    description: 'رصيدها محفوظ ولا تستقبل دفعات',
    share: 0,
    maxActive: Number.POSITIVE_INFINITY,
  },
] as const

export type WishFundingLevel = typeof WISH_FUNDING_LEVELS[number]['id']

export type WishDistributionInput = {
  id: string
  target: number
  saved: number
  fundingLevel: WishFundingLevel
}

export type WishFundingPortfolioInput = {
  id: string
  fundingLevel?: unknown
  legacyNeedPercent?: unknown
}

export type WishFundDistribution = {
  allocations: Record<string, number>
  allocatedAmount: number
  reserveAmount: number
  scale: number
}

export type WishFundLedger = {
  amount: number
  allocations: Record<string, number>
  allocatedAmount: number
  reserveAmount: number
}

const MONEY_PRECISION = 100
const ACTIVE_WISH_LIMIT = 3

export const roundMoney = (value: number) =>
  Math.round((Number.isFinite(value) ? value : 0) * MONEY_PRECISION) / MONEY_PRECISION

export const isWishFundingLevel = (value: unknown): value is WishFundingLevel =>
  WISH_FUNDING_LEVELS.some((level) => level.id === value)

export const normalizeWishFundingLevel = (
  value: unknown,
  legacyNeedPercent?: unknown,
): WishFundingLevel => {
  if (isWishFundingLevel(value)) return value
  const legacy = Number(legacyNeedPercent)
  if (legacy >= 5) return 'primary'
  if (legacy >= 3) return 'medium'
  return 'calm'
}

export const getWishFundingLevel = (value: unknown, legacyNeedPercent?: unknown) => {
  const id = normalizeWishFundingLevel(value, legacyNeedPercent)
  return WISH_FUNDING_LEVELS.find((level) => level.id === id) ?? WISH_FUNDING_LEVELS[2]
}

export const resolveWishFundingPortfolio = (
  wishes: WishFundingPortfolioInput[],
): Record<string, WishFundingLevel> => {
  const resolved: Record<string, WishFundingLevel> = {}
  const counts: Record<Exclude<WishFundingLevel, 'paused'>, number> = {
    primary: 0,
    medium: 0,
    calm: 0,
  }
  let activeCount = 0

  const ordered = [
    ...wishes.filter((wish) => isWishFundingLevel(wish.fundingLevel)),
    ...wishes.filter((wish) => !isWishFundingLevel(wish.fundingLevel)),
  ]

  ordered.forEach((wish) => {
    const explicit = isWishFundingLevel(wish.fundingLevel)
    const desired = normalizeWishFundingLevel(wish.fundingLevel, wish.legacyNeedPercent)
    if (desired === 'paused') {
      resolved[wish.id] = 'paused'
      return
    }

    const candidates: Array<Exclude<WishFundingLevel, 'paused'>> = explicit
      ? [desired]
      : desired === 'primary'
        ? ['primary', 'medium', 'calm']
        : desired === 'medium'
          ? ['medium', 'calm']
          : ['calm']
    const available = candidates.find((candidate) => (
      activeCount < ACTIVE_WISH_LIMIT
      && counts[candidate] < getWishFundingLevel(candidate).maxActive
    ))
    if (!available) {
      resolved[wish.id] = 'paused'
      return
    }

    resolved[wish.id] = available
    counts[available] += 1
    activeCount += 1
  })

  return resolved
}

export const getWishFundingCapacityError = (
  wishes: Array<{ id: string; fundingLevel: WishFundingLevel }>,
  wishId: string,
  nextLevel: WishFundingLevel,
) => {
  if (nextLevel === 'paused') return ''
  const others = wishes.filter((wish) => wish.id !== wishId && wish.fundingLevel !== 'paused')
  if (others.length >= ACTIVE_WISH_LIMIT) return 'عندكم 3 أماني نشطة بالفعل. علّق أمنية قبل تفعيل غيرها.'
  const sameLevelCount = others.filter((wish) => wish.fundingLevel === nextLevel).length
  const definition = getWishFundingLevel(nextLevel)
  if (sameLevelCount >= definition.maxActive) {
    if (nextLevel === 'primary') return 'يمكن اختيار أمنية أساسية واحدة فقط.'
    if (nextLevel === 'medium') return 'يمكن اختيار أمنيتين متوسطتين كحد أقصى.'
  }
  return ''
}

export const distributeWishesFund = (
  amountInput: number,
  wishes: WishDistributionInput[],
): WishFundDistribution => {
  const amount = Math.max(0, roundMoney(amountInput))
  const requested = wishes
    .map((wish) => {
      const remaining = Math.max(0, roundMoney(wish.target - wish.saved))
      const share = getWishFundingLevel(wish.fundingLevel).share
      return {
        id: wish.id,
        requested: Math.min(remaining, amount * (share / 100)),
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

export const appendWishFundContribution = (
  current: {
    amount?: unknown
    budget?: unknown
    allocations?: unknown
    reserveAmount?: unknown
  } | null,
  contributionInput: number,
  distribution: WishFundDistribution,
): WishFundLedger => {
  const existingAmount = Math.max(0, Number(current?.amount ?? current?.budget ?? 0))
  const existingAllocations = current?.allocations
    && typeof current.allocations === 'object'
    && !Array.isArray(current.allocations)
    ? current.allocations as Record<string, unknown>
    : {}
  const allocations: Record<string, number> = {}
  Object.entries(existingAllocations).forEach(([wishId, allocation]) => {
    const amount = Math.max(0, Number(allocation || 0))
    if (Number.isFinite(amount) && amount > 0) allocations[wishId] = roundMoney(amount)
  })
  Object.entries(distribution.allocations).forEach(([wishId, allocation]) => {
    allocations[wishId] = roundMoney((allocations[wishId] ?? 0) + allocation)
  })

  const existingAllocatedAmount = roundMoney(
    Object.values(existingAllocations).reduce(
      (total: number, allocation) => total + Math.max(0, Number(allocation || 0)),
      0,
    ),
  )
  const rawExistingReserve = Number(current?.reserveAmount)
  const existingReserveAmount = Number.isFinite(rawExistingReserve)
    ? Math.max(0, rawExistingReserve)
    : Math.max(0, existingAmount - existingAllocatedAmount)
  const contribution = Math.max(0, roundMoney(contributionInput))

  return {
    amount: roundMoney(existingAmount + contribution),
    allocations,
    allocatedAmount: roundMoney(existingAllocatedAmount + distribution.allocatedAmount),
    reserveAmount: roundMoney(existingReserveAmount + distribution.reserveAmount),
  }
}

export const getProjectedMonthlyWishShare = (
  monthlyFundAmountInput: number,
  fundingLevelInput: WishFundingLevel,
  activeShareTotal: number,
) => {
  const monthlyFundAmount = Math.max(0, roundMoney(monthlyFundAmountInput))
  const share = getWishFundingLevel(fundingLevelInput).share
  const scale = activeShareTotal > 100 ? 100 / activeShareTotal : 1
  return roundMoney(monthlyFundAmount * (share / 100) * scale)
}

export const getWishCompletionForecast = ({
  target,
  saved,
  monthlyFundAmount,
  fundingLevel,
  activeShareTotal,
  monthKey,
}: {
  target: number
  saved: number
  monthlyFundAmount: number
  fundingLevel: WishFundingLevel
  activeShareTotal: number
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
    fundingLevel,
    activeShareTotal,
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
