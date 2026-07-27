import { useCallback, useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import {
  addMonthlyTransaction,
  importRatibiMonthlyPlan,
  saveMonthlyPlan,
  subscribeToMonthlyPlan,
  type MonthlyPlan,
} from '../lib/monthlyPlanRepository'
import type { BudgetCategory } from '../lib/financialEngine'
import { getFirebaseErrorMessage } from '../lib/firebaseErrors'
import type { RatibiFinanceBundleV1 } from '../lib/ratibiImport'

type MonthlyPlanStatus = 'loading' | 'empty' | 'ready' | 'error'

export function useMonthlyPlan(user: User, monthKey: string) {
  const [plan, setPlan] = useState<MonthlyPlan | null>(null)
  const [status, setStatus] = useState<MonthlyPlanStatus>('loading')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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

  return { plan, status, error, saving, savePlan, addExpense, importFromRatibi }
}
