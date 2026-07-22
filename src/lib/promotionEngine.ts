export type PromotionProfileId = 'balanced' | 'security' | 'lifestyle'

export type PromotionBucketId = 'commitments' | 'needs' | 'future' | 'goals' | 'lifestyle' | 'giving'

export type PromotionBucket = {
  id: PromotionBucketId
  title: string
  description: string
  icon: string
  tone: 'violet' | 'lavender' | 'apricot' | 'coral' | 'ink' | 'mint'
  before: number
  added: number
  after: number
  raiseShare: number
}

export type PromotionProfile = {
  id: PromotionProfileId
  title: string
  subtitle: string
  description: string
  icon: string
  distribution: Record<PromotionBucketId, number>
}

export type PromotionSimulation = {
  currentSalary: number
  newSalary: number
  increase: number
  increaseRate: number
  annualIncrease: number
  profile: PromotionProfile
  buckets: PromotionBucket[]
  futureAdded: number
  lifestyleAdded: number
  protectedRate: number
}

export type SavedPromotionScenario = {
  id: string
  name: string
  currentSalary: number
  newSalary: number
  profileId: PromotionProfileId
  increase: number
  increaseRate: number
  createdAt: string
}

const baseDistribution: Record<PromotionBucketId, number> = {
  commitments: 40,
  needs: 22,
  future: 18,
  goals: 8,
  lifestyle: 8,
  giving: 4,
}

const bucketDefinitions: Record<PromotionBucketId, Omit<PromotionBucket, 'before' | 'added' | 'after' | 'raiseShare'>> = {
  commitments: { id: 'commitments', title: 'الالتزامات', description: 'الإيجار والفواتير والديون', icon: '⌂', tone: 'ink' },
  needs: { id: 'needs', title: 'الاحتياجات', description: 'البيت والمقاضي والأساسيات', icon: '◫', tone: 'lavender' },
  future: { id: 'future', title: 'المستقبل', description: 'الاستثمار والطوارئ', icon: '↗', tone: 'violet' },
  goals: { id: 'goals', title: 'الأهداف', description: 'الأماني والسفر والمشاريع', icon: '◎', tone: 'apricot' },
  lifestyle: { id: 'lifestyle', title: 'جودة الحياة', description: 'المطاعم والترفيه والتطوير', icon: '✦', tone: 'coral' },
  giving: { id: 'giving', title: 'العطاء', description: 'الصدقة والهدايا', icon: '♡', tone: 'mint' },
}

export const promotionProfiles: PromotionProfile[] = [
  {
    id: 'balanced',
    title: 'توازن ذكي',
    subtitle: 'الخيار المقترح',
    description: 'ترفع الأمان والأهداف بدون ما تحرم نفسك من أثر الترقية.',
    icon: '◉',
    distribution: { commitments: 15, needs: 10, future: 30, goals: 25, lifestyle: 15, giving: 5 },
  },
  {
    id: 'security',
    title: 'تسريع الأمان',
    subtitle: 'للتأسيس القوي',
    description: 'يوجه أغلب الزيادة للاستثمار والطوارئ والأهداف الكبيرة.',
    icon: '🛡️',
    distribution: { commitments: 10, needs: 5, future: 40, goals: 35, lifestyle: 5, giving: 5 },
  },
  {
    id: 'lifestyle',
    title: 'جودة حياة',
    subtitle: 'تحسن محسوس',
    description: 'يحافظ على الادخار ويمنحك مساحة أكبر للاستمتاع بالترقية.',
    icon: '✦',
    distribution: { commitments: 10, needs: 10, future: 25, goals: 15, lifestyle: 35, giving: 5 },
  },
]

export const getPromotionProfile = (id: PromotionProfileId) => promotionProfiles.find((profile) => profile.id === id) ?? promotionProfiles[0]

const roundMoney = (value: number) => Math.round(value)

export const buildPromotionSimulation = (
  currentSalaryInput: number,
  newSalaryInput: number,
  profileId: PromotionProfileId,
): PromotionSimulation => {
  const currentSalary = Math.max(0, Number.isFinite(currentSalaryInput) ? currentSalaryInput : 0)
  const newSalary = Math.max(currentSalary, Number.isFinite(newSalaryInput) ? newSalaryInput : currentSalary)
  const increase = roundMoney(newSalary - currentSalary)
  const increaseRate = currentSalary > 0 ? Math.round((increase / currentSalary) * 1000) / 10 : 0
  const profile = getPromotionProfile(profileId)

  const buckets = (Object.keys(bucketDefinitions) as PromotionBucketId[]).map((id) => {
    const before = roundMoney(currentSalary * (baseDistribution[id] / 100))
    const added = roundMoney(increase * (profile.distribution[id] / 100))
    return {
      ...bucketDefinitions[id],
      before,
      added,
      after: before + added,
      raiseShare: profile.distribution[id],
    }
  })

  const futureAdded = buckets
    .filter((bucket) => bucket.id === 'future' || bucket.id === 'goals')
    .reduce((sum, bucket) => sum + bucket.added, 0)
  const lifestyleAdded = buckets.find((bucket) => bucket.id === 'lifestyle')?.added ?? 0
  const protectedRate = increase > 0 ? Math.round((futureAdded / increase) * 100) : 0

  return {
    currentSalary,
    newSalary,
    increase,
    increaseRate,
    annualIncrease: increase * 12,
    profile,
    buckets,
    futureAdded,
    lifestyleAdded,
    protectedRate,
  }
}

export const buildSalaryOptions = (currentSalary: number) => [20, 25, 30].map((rate) => ({
  rate,
  salary: roundMoney(currentSalary * (1 + rate / 100)),
}))

export const describePromotion = (simulation: PromotionSimulation) => {
  if (simulation.increase <= 0) return 'اكتب راتبًا أعلى من راتبك الحالي حتى تظهر خطة توزيع الزيادة.'
  if (simulation.protectedRate >= 70) return `هذه الخطة تحمي ${simulation.protectedRate}% من الزيادة للمستقبل والأهداف.`
  if (simulation.lifestyleAdded >= simulation.futureAdded) return 'هذه الخطة مريحة الآن، لكنها أبطأ في بناء الأمان المالي.'
  return `تستفيد اليوم وتحمي ${simulation.protectedRate}% من الزيادة للمستقبل.`
}
