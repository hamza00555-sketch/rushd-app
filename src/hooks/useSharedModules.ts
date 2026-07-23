import { useCallback, useEffect, useRef, useState } from 'react'
import type { Unsubscribe, User } from 'firebase/auth'
import {
  addSharedMarketExpense,
  addSharedWish,
  loadSharedWorkspaceData,
  saveSharedMarketBudget,
  subscribeToMemberAccess,
  subscribeToSharedData,
  type SharedMarketBudget,
  type SharedMarketExpense,
  type SharedWish,
  type SharedWorkspaceData,
} from '../lib/householdRepository'
import type { AccessLevel, SharedModule } from '../lib/household'
import { getFirebaseErrorMessage } from '../lib/firebaseErrors'

export type SharedSyncStatus = 'connecting' | 'synced' | 'error'

const noAccess: Record<SharedModule, AccessLevel> = {
  market: 'none',
  wishes: 'none',
  noor: 'none',
}

export function useSharedModules(user: User, marketMonthKey: string) {
  const [wishes, setWishes] = useState<SharedWish[]>([])
  const [marketBudget, setMarketBudget] = useState<SharedMarketBudget | null>(null)
  const [marketExpenses, setMarketExpenses] = useState<SharedMarketExpense[]>([])
  const [isHouseholdOwner, setIsHouseholdOwner] = useState(false)
  const [permissions, setPermissions] = useState<Record<SharedModule, AccessLevel>>(noAccess)
  const [status, setStatus] = useState<SharedSyncStatus>('connecting')
  const [error, setError] = useState('')
  const householdIdRef = useRef<string | null>(null)
  const marketMonthKeyRef = useRef(marketMonthKey)
  const isHouseholdOwnerRef = useRef(false)
  const sharedRealtimeRef = useRef<Unsubscribe | null>(null)
  const memberRealtimeRef = useRef<Unsubscribe | null>(null)
  const permissionsRef = useRef(noAccess)
  marketMonthKeyRef.current = marketMonthKey

  const applyData = useCallback((data: SharedWorkspaceData) => {
    householdIdRef.current = data.householdId
    isHouseholdOwnerRef.current = data.isOwner
    permissionsRef.current = data.permissions
    setIsHouseholdOwner(data.isOwner)
    setPermissions(data.permissions)
    setWishes(data.wishes)
    setMarketBudget(data.marketBudget)
    setMarketExpenses(data.marketExpenses)
    setStatus('synced')
    setError('')
  }, [])

  const fail = useCallback((cause: unknown) => {
    setStatus('error')
    setError(getFirebaseErrorMessage(cause, 'تعذر تحديث بيانات البيت.'))
  }, [])

  const refreshData = useCallback(async () => {
    const data = await loadSharedWorkspaceData(user, marketMonthKey)
    if (marketMonthKeyRef.current === marketMonthKey) applyData(data)
    return data
  }, [applyData, marketMonthKey, user])

  const connectSharedRealtime = useCallback((data: SharedWorkspaceData) => {
    sharedRealtimeRef.current?.()
    sharedRealtimeRef.current = subscribeToSharedData(data.householdId, data.permissions, marketMonthKey, () => {
      void refreshData().catch(fail)
    }, fail)
  }, [fail, marketMonthKey, refreshData])

  useEffect(() => {
    let active = true
    setStatus('connecting')
    setError('')
    setWishes([])
    setMarketBudget(null)
    setMarketExpenses([])

    void refreshData()
      .then((data) => {
        if (!active) return
        connectSharedRealtime(data)
        let firstMemberSnapshot = true
        memberRealtimeRef.current = subscribeToMemberAccess(data.householdId, user.uid, () => {
          if (firstMemberSnapshot) {
            firstMemberSnapshot = false
            return
          }
          void refreshData().then((nextData) => {
            if (!active) return
            connectSharedRealtime(nextData)
          }).catch(fail)
        }, fail)
      })
      .catch(fail)

    return () => {
      active = false
      sharedRealtimeRef.current?.()
      memberRealtimeRef.current?.()
      sharedRealtimeRef.current = null
      memberRealtimeRef.current = null
      householdIdRef.current = null
    }
  }, [connectSharedRealtime, fail, refreshData, user.uid])

  const saveMarketBudget = useCallback(async (budget: number) => {
    const householdId = householdIdRef.current
    if (!householdId) throw new Error('مساحة العائلة ما زالت قيد التحميل.')
    if (!isHouseholdOwnerRef.current) throw new Error('رب الأسرة فقط يقدر يحدد ميزانية السوبرماركت.')
    await saveSharedMarketBudget(householdId, user, marketMonthKey, budget)
    await refreshData()
  }, [marketMonthKey, refreshData, user])

  const addMarketExpense = useCallback(async (amount: number, title: string) => {
    const householdId = householdIdRef.current
    if (!householdId) throw new Error('مساحة العائلة ما زالت قيد التحميل.')
    if (permissionsRef.current.market !== 'edit') throw new Error('صلاحيتك في السوبرماركت للعرض فقط.')
    if (!marketBudget) throw new Error('حدّد ميزانية الشهر قبل تسجيل أي مشتريات.')
    await addSharedMarketExpense(householdId, user, marketMonthKey, amount, title)
    await refreshData()
  }, [marketBudget, marketMonthKey, refreshData, user])

  const addWish = useCallback(async (input: { title: string; icon: string; target: number; deadline: string }) => {
    const householdId = householdIdRef.current
    if (!householdId) throw new Error('مساحة العائلة ما زالت قيد التحميل.')
    if (permissionsRef.current.wishes !== 'edit') throw new Error('صلاحيتك في الأماني للعرض فقط.')
    await addSharedWish(householdId, user, input)
    await refreshData()
  }, [refreshData, user])

  return {
    wishes,
    marketBudget,
    marketExpenses,
    isHouseholdOwner,
    permissions,
    status,
    error,
    saveMarketBudget,
    addMarketExpense,
    addWish,
  }
}
