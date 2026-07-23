import { ARABIC_GREGORIAN_LOCALE } from './locale'

export type InvestmentAccountType = 'investment' | 'cash' | 'child'

export type InvestmentAccount = {
  id: string
  name: string
  type: InvestmentAccountType
  balance: number
  monthlyContribution: number
  annualReturn: number
  icon: string
}

export type FinancialGoal = {
  id: string
  name: string
  target: number
  saved: number
  monthlyContribution: number
  priority: 'high' | 'medium' | 'low'
  linkedWish: string | null
  icon: string
}

export type GoalProjection = FinancialGoal & {
  progress: number
  remaining: number
  monthsToGoal: number | null
  projectedDate: string
  monthlyNeededForYear: number
  status: 'complete' | 'on-track' | 'slow' | 'paused'
}

export type WealthSnapshot = {
  totalBalance: number
  totalMonthlyContribution: number
  projectedInOneYear: number
  projectedInFiveYears: number
  investmentGrowthFiveYears: number
  goalsTarget: number
  goalsSaved: number
  goalsProgress: number
  closestGoal: GoalProjection | null
}

const roundMoney = (value: number) => Math.round(value)

export const futureValue = (balance: number, monthlyContribution: number, annualReturn: number, months: number) => {
  const monthlyRate = Math.max(0, annualReturn) / 100 / 12
  if (months <= 0) return roundMoney(balance)
  if (monthlyRate === 0) return roundMoney(balance + monthlyContribution * months)
  const grownBalance = balance * Math.pow(1 + monthlyRate, months)
  const contributions = monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
  return roundMoney(grownBalance + contributions)
}

export const monthsUntilGoal = (goal: FinancialGoal) => {
  const remaining = Math.max(0, goal.target - goal.saved)
  if (remaining === 0) return 0
  if (goal.monthlyContribution <= 0) return null
  return Math.ceil(remaining / goal.monthlyContribution)
}

const formatProjectedDate = (months: number | null) => {
  if (months === null) return 'بدون خطة شهرية'
  if (months === 0) return 'مكتمل الآن'
  const date = new Date()
  date.setMonth(date.getMonth() + months)
  return date.toLocaleDateString(ARABIC_GREGORIAN_LOCALE, { month: 'long', year: 'numeric' })
}

export const projectGoal = (goal: FinancialGoal): GoalProjection => {
  const remaining = Math.max(0, goal.target - goal.saved)
  const monthsToGoal = monthsUntilGoal(goal)
  const progress = goal.target > 0 ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0
  const monthlyNeededForYear = roundMoney(remaining / 12)
  const status: GoalProjection['status'] = remaining === 0
    ? 'complete'
    : goal.monthlyContribution <= 0
      ? 'paused'
      : monthsToGoal !== null && monthsToGoal <= 12
        ? 'on-track'
        : 'slow'

  return {
    ...goal,
    progress,
    remaining,
    monthsToGoal,
    projectedDate: formatProjectedDate(monthsToGoal),
    monthlyNeededForYear,
    status,
  }
}

export const buildWealthSnapshot = (accounts: InvestmentAccount[], goals: FinancialGoal[]): WealthSnapshot => {
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0)
  const totalMonthlyContribution = accounts.reduce((sum, account) => sum + account.monthlyContribution, 0)
  const projectedInOneYear = accounts.reduce((sum, account) => sum + futureValue(account.balance, account.monthlyContribution, account.annualReturn, 12), 0)
  const projectedInFiveYears = accounts.reduce((sum, account) => sum + futureValue(account.balance, account.monthlyContribution, account.annualReturn, 60), 0)
  const contributedFiveYears = totalBalance + totalMonthlyContribution * 60
  const projections = goals.map(projectGoal)
  const goalsTarget = goals.reduce((sum, goal) => sum + goal.target, 0)
  const goalsSaved = goals.reduce((sum, goal) => sum + goal.saved, 0)
  const activeGoals = projections.filter((goal) => goal.status !== 'complete' && goal.monthsToGoal !== null)
  const closestGoal = activeGoals.sort((a, b) => (a.monthsToGoal ?? Infinity) - (b.monthsToGoal ?? Infinity))[0]
    ?? projections.find((goal) => goal.status === 'complete')
    ?? null

  return {
    totalBalance: roundMoney(totalBalance),
    totalMonthlyContribution: roundMoney(totalMonthlyContribution),
    projectedInOneYear: roundMoney(projectedInOneYear),
    projectedInFiveYears: roundMoney(projectedInFiveYears),
    investmentGrowthFiveYears: roundMoney(Math.max(0, projectedInFiveYears - contributedFiveYears)),
    goalsTarget: roundMoney(goalsTarget),
    goalsSaved: roundMoney(goalsSaved),
    goalsProgress: goalsTarget > 0 ? Math.min(100, Math.round((goalsSaved / goalsTarget) * 100)) : 0,
    closestGoal,
  }
}

export const buildProjectionPoints = (accounts: InvestmentAccount[]) => [0, 12, 24, 36, 48, 60].map((months) => ({
  months,
  value: accounts.reduce((sum, account) => sum + futureValue(account.balance, account.monthlyContribution, account.annualReturn, months), 0),
}))

export const getWealthInsight = (snapshot: WealthSnapshot) => {
  if (snapshot.totalMonthlyContribution <= 0) return 'فعّل مساهمة شهرية ولو بسيطة؛ الاستمرارية أهم من البداية الكبيرة.'
  if (snapshot.investmentGrowthFiveYears > snapshot.totalMonthlyContribution * 12) return `النمو المتوقع يضيف ${snapshot.investmentGrowthFiveYears.toLocaleString('ar-SA')} ريال خلال خمس سنوات فوق مساهماتك.`
  if (snapshot.closestGoal) return `أقرب هدف هو ${snapshot.closestGoal.name}، والوصول المتوقع في ${snapshot.closestGoal.projectedDate}.`
  return 'أضف هدفًا ماليًا حتى أربط استثماراتك بالشيء الذي تريد الوصول إليه.'
}
