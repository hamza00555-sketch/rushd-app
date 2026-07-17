export type Allocation = {
  label: string
  amount: number
  tone: 'violet' | 'lavender' | 'apricot' | 'coral'
}

export const formatSar = (value: number) =>
  new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(value)

export const getSpentPercentage = (spent: number, total: number) =>
  total <= 0 ? 0 : Math.min(100, Math.round((spent / total) * 100))

export const monthlyAllocations: Allocation[] = [
  { label: 'الاحتياجات الأساسية', amount: 6000, tone: 'violet' },
  { label: 'الادخار والاستثمار', amount: 3000, tone: 'lavender' },
  { label: 'أماني رُشد', amount: 2500, tone: 'apricot' },
  { label: 'المصروف الشخصي', amount: 1500, tone: 'coral' },
]
