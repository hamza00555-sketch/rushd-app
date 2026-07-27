import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import {
  addMonthlyTransaction,
  importRatibiMonthlyPlan,
  saveMonthlyPlan,
  subscribeToMonthlyPlan,
  subscribeToRatibiSync,
  type MonthlyPlan,
  type RatibiSyncSnapshot,
} from '../lib/monthlyPlanRepository'
import type { BudgetCategory } from '../lib/financialEngine'
import { getFirebaseErrorMessage } from '../lib/firebaseErrors'
import type { RatibiFinanceBundleV1 } from '../lib/ratibiImport'

type MonthlyPlanStatus = 'loading' | 'empty' | 'ready' | 'error'
export type RatibiSyncStatus = 'connecting' | 'waiting' | 'syncing' | 'connected' | 'error'

export type RatibiSyncState = {
  status: RatibiSyncStatus
  lastExportedAt: string | null
  fromCache: boolean
  error: string
}

export function useMonthlyPlan(user: User, monthKey: string) {
  const [plan, setPlan] = useState<MonthlyPlan | null>(null)
  const [status, setStatus] = useState<MonthlyPlanStatus>('loading')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [ratibiSnapshot, setRatibiSnapshot] = useState<RatibiSyncSnapshot | null>(null)
  const [ratibiSync, setRatibiSync] = useState<RatibiSyncState>({
    status: 'connecting',
    lastExportedAt: null,
    fromCache: false,
    error: '',
  })
  const importingExportRef = useRef<string | null>(null)

  useEffect(() => {
    setStatus('loading')
    setError('')
    setPlan(null)
    return subscribeToMonthlyPlan(user.uid, monthKey, (nextPlan) => {
      setPlan(nextPlan)
      setStatus(nextPlan ? 'ready' : 'empty')
      setError('')
    }, (cause) => {
      setError(getFirebaseErrorMessage(cause, 'تعذر تحميل حساب الشهر.'))
      setStatus('error')
    })
  }, [monthKey, user.uid])

  const savePlan = useCallback(async (salary: number, categories: BudgetCategory[]) => {
    setSaving(true)
    setError('')
    try {
      await saveMonthlyPlan(user.uid, monthKey, salary, categories, !plan)
    } catch (cause: unknown) {
      const message = getFirebaseErrorMessage(cause, 'تعذر حفظ خطة الشهر.')
      setError(message)
      throw new Error(message)
    } finally {
      setSaving(false)
    }
  }, [monthKey, plan, user.uid])

  const addExpense = useCallback(async (title: string, amount: number, categoryId: string) => {
    setSaving(true)
    setError('')
    try {
      await addMonthlyTransaction(user.uid, monthKey, { title, amount, categoryId })
    } catch (cause: unknown) {
      const message = getFirebaseErrorMessage(cause, 'تعذر تسجيل المصروف.')
      setError(message)
      throw new Error(message)
    } finally {
      setSaving(false)
    }
  }, [monthKey, user.uid])

  const importFromRatibi = useCallback(async (bundle: RatibiFinanceBundleV1) => {
    setSaving(true)
    setError('')
    try {
      await importRatibiMonthlyPlan(user.uid, bundle)
    } catch (cause: unknown) {
      const message = getFirebaseErrorMessage(cause, 'تعذر استيراد بيانات راتبي.')
      setError(message)
      throw new Error(message)
    } finally {
      setSaving(false)
    }
  }, [user.uid])

  useEffect(() => {
    setRatibiSnapshot(null)
    setRatibiSync({
      status: 'connecting',
      lastExportedAt: null,
      fromCache: false,
      error: '',
    })

    return subscribeToRatibiSync(user.uid, monthKey, (nextSnapshot) => {
      setRatibiSnapshot(nextSnapshot)
      if (!nextSnapshot) {
        setRatibiSync({
          status: 'waiting',
          lastExportedAt: null,
          fromCache: false,
          error: '',
        })
        return
      }
      setRatibiSync({
        status: 'syncing',
        lastExportedAt: nextSnapshot.bundle.exportedAt,
        fromCache: nextSnapshot.fromCache,
        error: '',
      })
    }, (cause) => {
      setRatibiSnapshot(null)
      setRatibiSync({
        status: 'error',
        lastExportedAt: null,
        fromCache: false,
        error: getFirebaseErrorMessage(cause, 'تعذر الاتصال بتطبيق راتبي.'),
      })
    })
  }, [monthKey, user.uid])

  useEffect(() => {
    if (!ratibiSnapshot) return

    const { bundle, fromCache } = ratibiSnapshot
    const alreadyImported = plan?.source === 'ratibi'
      && plan.sourceExportedAt === bundle.exportedAt

    if (alreadyImported) {
      importingExportRef.current = null
      setRatibiSync({
        status: 'connected',
        lastExportedAt: bundle.exportedAt,
        fromCache,
        error: '',
      })
      return
    }

    if (importingExportRef.current === bundle.exportedAt) return
    importingExportRef.current = bundle.exportedAt
    setRatibiSync({
      status: 'syncing',
      lastExportedAt: bundle.exportedAt,
      fromCache,
      error: '',
    })

    void importFromRatibi(bundle)
      .then(() => {
        setRatibiSync({
          status: 'connected',
          lastExportedAt: bundle.exportedAt,
          fromCache,
          error: '',
        })
      })
      .catch((cause: unknown) => {
        importingExportRef.current = null
        setRatibiSync({
          status: 'error',
          lastExportedAt: bundle.exportedAt,
          fromCache,
          error: getFirebaseErrorMessage(cause, 'وصلت بيانات راتبي لكن تعذر حفظها.'),
        })
      })
  }, [importFromRatibi, plan?.source, plan?.sourceExportedAt, ratibiSnapshot])

  return {
    plan,
    status,
    error,
    saving,
    ratibiSync,
    savePlan,
    addExpense,
    importFromRatibi,
  }
}
