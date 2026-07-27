export const formatSar = (value: number) =>
  new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(value)

export const getSpentPercentage = (spent: number, total: number) =>
  total <= 0 ? 0 : Math.min(100, Math.round((spent / total) * 100))
