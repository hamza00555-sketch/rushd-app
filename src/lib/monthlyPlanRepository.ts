import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { BudgetCategory, CategoryTone } from './financialEngine'

export type MonthlyTransaction = {
  id: string
  title: string
  amount: number
  categoryId: string
  occurredAt: Date
}

export type MonthlyPlan = {
  monthKey: string
  salary: number
  categories: BudgetCategory[]
  transactions: MonthlyTransaction[]
  fromCache: boolean
  hasPendingWrites: boolean
}

type PlanRecord = {
  salary: number
  categories: BudgetCategory[]
}

const validTones: CategoryTone[] = ['violet', 'lavender', 'apricot', 'coral']

const monthPath = (userId: string, monthKey: string) => doc(db, 'users', userId, 'monthlyPlans', monthKey)

const normalizeCategory = (input: Record<string, unknown>): BudgetCategory => ({
  id: String(input.id || ''),
  title: String(input.title || 'فئة'),
  icon: String(input.icon || '•'),
  limit: Math.max(0, Number(input.limit || 0)),
  spent: 0,
  tone: validTones.includes(input.tone as CategoryTone) ? input.tone as CategoryTone : 'violet',
})

const serializeCategories = (categories: BudgetCategory[]) => categories.map((category) => ({
  id: category.id,
  title: category.title,
  icon: category.icon,
  limit: Math.max(0, Math.round(category.limit)),
  tone: category.tone,
}))

const applyTransactions = (categories: BudgetCategory[], transactions: MonthlyTransaction[]) => categories.map((category) => ({
  ...category,
  spent: transactions
    .filter((transaction) => transaction.categoryId === category.id)
    .reduce((sum, transaction) => sum + transaction.amount, 0),
}))

export const getCurrentMonthKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export const getNextMonthKey = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number)
  return getCurrentMonthKey(new Date(year, month, 1))
}

export const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })
}

export const formatTransactionDate = (date: Date) => date.toLocaleDateString('ar-SA', {
  day: 'numeric',
  month: 'short',
})

export const subscribeToMonthlyPlan = (
  userId: string,
  monthKey: string,
  onChange: (plan: MonthlyPlan | null) => void,
  onError: (cause: unknown) => void,
): Unsubscribe => {
  const planRef = monthPath(userId, monthKey)
  const transactionsQuery = query(collection(planRef, 'transactions'), orderBy('occurredAt', 'desc'))
  let planRecord: PlanRecord | null = null
  let transactions: MonthlyTransaction[] = []
  let planLoaded = false
  let transactionsLoaded = false
  let planFromCache = false
  let transactionsFromCache = false
  let planPending = false
  let transactionsPending = false

  const emit = () => {
    if (!planLoaded || !transactionsLoaded) return
    if (!planRecord) {
      onChange(null)
      return
    }
    onChange({
      monthKey,
      salary: planRecord.salary,
      categories: applyTransactions(planRecord.categories, transactions),
      transactions,
      fromCache: planFromCache || transactionsFromCache,
      hasPendingWrites: planPending || transactionsPending,
    })
  }

  const unsubscribePlan = onSnapshot(planRef, { includeMetadataChanges: true }, (snapshot) => {
    planLoaded = true
    planFromCache = snapshot.metadata.fromCache
    planPending = snapshot.metadata.hasPendingWrites
    if (!snapshot.exists()) {
      planRecord = null
    } else {
      const data = snapshot.data()
      const rawCategories = Array.isArray(data.categories) ? data.categories : []
      planRecord = {
        salary: Math.max(0, Number(data.salary || 0)),
        categories: rawCategories.map((category) => normalizeCategory(category as Record<string, unknown>)),
      }
    }
    emit()
  }, onError)

  const unsubscribeTransactions = onSnapshot(transactionsQuery, { includeMetadataChanges: true }, (snapshot) => {
    transactionsLoaded = true
    transactionsFromCache = snapshot.metadata.fromCache
    transactionsPending = snapshot.metadata.hasPendingWrites
    transactions = snapshot.docs.map((item) => {
      const data = item.data()
      const occurredAt = data.occurredAt instanceof Timestamp ? data.occurredAt.toDate() : new Date()
      return {
        id: item.id,
        title: String(data.title || 'مصروف'),
        amount: Math.max(0, Number(data.amount || 0)),
        categoryId: String(data.categoryId || ''),
        occurredAt,
      }
    })
    emit()
  }, onError)

  return () => {
    unsubscribePlan()
    unsubscribeTransactions()
  }
}

export const saveMonthlyPlan = async (
  userId: string,
  monthKey: string,
  salary: number,
  categories: BudgetCategory[],
  isNew: boolean,
) => {
  const reference = monthPath(userId, monthKey)
  const record = {
    salary: Math.max(0, Math.round(salary)),
    categories: serializeCategories(categories),
    ...(isNew ? { createdAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  }
  await setDoc(reference, record, { merge: true })
}

export const addMonthlyTransaction = async (
  userId: string,
  monthKey: string,
  input: { title: string; amount: number; categoryId: string },
) => {
  const planRef = monthPath(userId, monthKey)
  const transactionRef = doc(collection(planRef, 'transactions'))
  const batch = writeBatch(db)
  batch.set(transactionRef, {
    title: input.title.trim(),
    amount: Math.max(0, input.amount),
    categoryId: input.categoryId,
    occurredAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  })
  batch.set(planRef, { updatedAt: serverTimestamp() }, { merge: true })
  await batch.commit()
  return transactionRef.id
}

export const loadMonthlyPlanOnce = async (userId: string, monthKey = getCurrentMonthKey()) => {
  const snapshot = await getDoc(monthPath(userId, monthKey))
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  return {
    salary: Math.max(0, Number(data.salary || 0)),
    categories: (Array.isArray(data.categories) ? data.categories : []).map((category) => normalizeCategory(category as Record<string, unknown>)),
  }
}
