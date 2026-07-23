export type CategoryTone = 'violet' | 'lavender' | 'apricot' | 'coral'

export type BudgetCategory = {
  id: string
  title: string
  icon: string
  limit: number
  spent: number
  tone: CategoryTone
}

export type FinancialSignal = {
  level: 'good' | 'watch' | 'danger'
  title: string
  body: string
}

const categoryBlueprints = [
  { id: 'needs', title: 'الاحتياجات الأساسية', icon: '🏠', ratio: 0.42, tone: 'violet' as const },
  { id: 'commitments', title: 'الالتزامات', icon: '📌', ratio: 0.23, tone: 'lavender' as const },
  { id: 'future', title: 'الاستثمار والأمان', icon: '🛡️', ratio: 0.22, tone: 'apricot' as const },
  { id: 'flex', title: 'الحياة المرنة', icon: '☕', ratio: 0.13, tone: 'coral' as const },
]

export const buildSuggestedBudget = (salary: number, current?: BudgetCategory[]) => {
  const safeSalary = Math.max(0, salary)

  return categoryBlueprints.map((blueprint, index) => {
    const limit = index === categoryBlueprints.length - 1
      ? safeSalary - categoryBlueprints.slice(0, -1).reduce((sum, item) => sum + Math.round(safeSalary * item.ratio), 0)
      : Math.round(safeSalary * blueprint.ratio)
    const previous = current?.find((category) => category.id === blueprint.id)

    return {
      id: blueprint.id,
      title: blueprint.title,
      icon: blueprint.icon,
      limit,
      spent: previous?.spent ?? 0,
      tone: blueprint.tone,
    }
  })
}

export const getFinancialSnapshot = (salary: number, categories: BudgetCategory[]) => {
  const spent = categories.reduce((sum, category) => sum + category.spent, 0)
  const budgeted = categories.reduce((sum, category) => sum + category.limit, 0)
  const remaining = Math.max(0, salary - spent)
  const utilization = salary <= 0 ? 0 : Math.round((spent / salary) * 100)
  const future = categories.find((category) => category.id === 'future')
  const futureRate = salary <= 0 ? 0 : Math.round(((future?.limit ?? 0) / salary) * 100)
  const overspent = categories.filter((category) => category.spent > category.limit).length
  const watch = categories.filter((category) => category.limit > 0 && category.spent / category.limit >= 0.8).length
  const score = Math.max(0, Math.min(100, 92 - overspent * 24 - watch * 7 - Math.max(0, utilization - 82)))

  return { spent, budgeted, remaining, utilization, futureRate, overspent, watch, score }
}

export const getFinancialSignals = (salary: number, categories: BudgetCategory[]): FinancialSignal[] => {
  const snapshot = getFinancialSnapshot(salary, categories)
  const signals: FinancialSignal[] = []
  const highest = [...categories].sort((a, b) => (b.limit ? b.spent / b.limit : 0) - (a.limit ? a.spent / a.limit : 0))[0]

  categories
    .filter((category) => category.spent > category.limit)
    .forEach((category) => signals.push({
      level: 'danger',
      title: `${category.title} تجاوزت الخطة`,
      body: `التجاوز الحالي ${Math.round(category.spent - category.limit).toLocaleString('ar-SA')} ريال. أوقف المصروف غير الضروري في هذه الفئة.`
    }))

  if (!snapshot.overspent && highest && highest.limit > 0 && highest.spent / highest.limit >= 0.8) {
    signals.push({
      level: 'watch',
      title: `${highest.title} تحتاج انتباه`,
      body: `استخدمت ${Math.round((highest.spent / highest.limit) * 100)}% من ميزانيتها. حافظ على المتبقي للأيام القادمة.`
    })
  }

  const future = categories.find((category) => category.id === 'future')
  if (future && future.spent < future.limit) {
    signals.push({
      level: 'good',
      title: 'فرصة تقوية الأمان المالي',
      body: `باقي ${Math.round(future.limit - future.spent).toLocaleString('ar-SA')} ريال للوصول لمخصص الاستثمار والأمان هذا الشهر.`
    })
  }

  if (snapshot.remaining > salary * 0.2) {
    signals.push({
      level: 'good',
      title: 'مساحة آمنة في الشهر',
      body: `عندك ${Math.round(snapshot.remaining).toLocaleString('ar-SA')} ريال غير مصروفة حتى الآن. لا تعتبرها متاحة كلها قبل إغلاق الالتزامات.`
    })
  }

  return signals.slice(0, 3)
}
