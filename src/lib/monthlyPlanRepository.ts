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
import { ARABIC_GREGORIAN_LOCALE } from './locale'
import {
  buildRatibiCategories,
  getRatibiIncomeTotal,
  parseRatibiBundle,
  type RatibiFinanceBundleV1,
} from './ratibiImport'

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
  source: 'manual' | 'ratibi'
  ratibi: RatibiFinanceBundleV1 | null
  sourceExportedAt: string | null
  fromCache: boolean
  hasPendingWrites: boolean
}

type PlanRecord = {
  salary: number
  categories: BudgetCategory[]
  source: 'manual' | 'ratibi'
  ratibi: RatibiFinanceBundleV1 | null
  sourceExportedAt: string | null
}

export type RatibiSyncSnapshot = {
  bundle: RatibiFinanceBundleV1
  fromCache: boolean
  hasPendingWrites: boolean
}

const validTones: CategoryTone[] = ['violet', 'lavender', 'apricot', 'coral']

const monthPath = (userId: string, monthKey: string) => doc(db, 'users', userId, 'monthlyPlans', monthKey)
const ratibiSyncPath = (userId: string, monthKey: string) => doc(db, 'users', userId, 'ratibiSync', monthKey)

const normalizeCategory = (input: Record<string, unknown>): BudgetCategory => ({
  id: String(input.id || ''),
  title: String(input.title || 'فئة'),
  icon: String(input.icon || '•'),
  limit: Math.max(0, Number(input.limit || 0)),
  spent: Math.max(0, Number(input.spent || 0)),
  tone: validTones.includes(input.tone as CategoryTone) ? input.tone as CategoryTone : 'violet',
})

const serializeCategories = (categories: BudgetCategory[]) => categories.map((category) => ({
  id: category.id,
  title: category.title,
  icon: category.icon,
  limit: Math.max(0, Math.round(category.limit)),
  spent: Math.max(0, Math.round(category.spent * 100) / 100),
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
  return new Date(year, month - 1, 1).toLocaleDateString(ARABIC_GREGORIAN_LOCALE, {
    month: 'long',
    year: 'numeric',
  })
}

export const formatTransactionDate = (date: Date) => date.toLocaleDateString(ARABIC_GREGORIAN_LOCALE, {
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
      categories: planRecord.source === 'ratibi'
        ? planRecord.categories
        : applyTransactions(planRecord.categories, transactions),
      transactions,
      source: planRecord.source,
      ratibi: planRecord.ratibi,
      sourceExportedAt: planRecord.sourceExportedAt,
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
      const source = data.source === 'ratibi' ? 'ratibi' : 'manual'
      let ratibi: RatibiFinanceBundleV1 | null = null
      if (source === 'ratibi' && data.ratibiSnapshot) {
        try {
          ratibi = parseRatibiBundle(data.ratibiSnapshot)
        } catch {
          ratibi = null
        }
      }
      planRecord = {
        salary: Math.max(0, Number(data.salary || 0)),
        categories: source === 'ratibi' && ratibi
          ? buildRatibiCategories(ratibi)
          : rawCategories.map((category) => normalizeCategory(category as Record<string, unknown>)),
        source,
        ratibi,
        sourceExportedAt: typeof data.sourceExportedAt === 'string'
          ? data.sourceExportedAt
          : ratibi?.exportedAt ?? null,
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

export const subscribeToRatibiSync = (
  userId: string,
  monthKey: string,
  onChange: (snapshot: RatibiSyncSnapshot | null) => void,
  onError: (cause: unknown) => void,
): Unsubscribe => onSnapshot(
  ratibiSyncPath(userId, monthKey),
  { includeMetadataChanges: true },
  (snapshot) => {
    if (!snapshot.exists()) {
      onChange(null)
      return
    }

    try {
      const bundle = parseRatibiBundle(snapshot.data().bundle)
      if (bundle.month !== monthKey) {
        throw new Error('شهر مزامنة راتبي لا يطابق الشهر المفتوح.')
      }
      onChange({
        bundle,
        fromCache: snapshot.metadata.fromCache,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
      })
    } catch (cause: unknown) {
      onError(cause)
    }
  },
  onError,
)

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
    source: 'manual',
    ...(isNew ? { createdAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  }
  await setDoc(reference, record, { merge: true })
}

export const importRatibiMonthlyPlan = async (
  userId: string,
  bundle: RatibiFinanceBundleV1,
) => {
  const reference = monthPath(userId, bundle.month)
  await setDoc(reference, {
    salary: getRatibiIncomeTotal(bundle),
    categories: serializeCategories(buildRatibiCategories(bundle)),
    source: 'ratibi',
    sourceApp: 'ratibi',
    sourceVersion: bundle.version,
    sourceExportedAt: bundle.exportedAt,
    ratibiSnapshot: bundle,
    updatedAt: serverTimestamp(),
    importedAt: serverTimestamp(),
  }, { merge: true })
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
  const source = data.source === 'ratibi' ? 'ratibi' as const : 'manual' as const
  const ratibi = source === 'ratibi' && data.ratibiSnapshot
    ? parseRatibiBundle(data.ratibiSnapshot)
    : null
  return {
    salary: Math.max(0, Number(data.salary || 0)),
    categories: source === 'ratibi' && ratibi
      ? buildRatibiCategories(ratibi)
      : (Array.isArray(data.categories) ? data.categories : []).map((category) => normalizeCategory(category as Record<string, unknown>)),
    source,
    ratibi,
  }
}
