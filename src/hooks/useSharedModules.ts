import { useCallback, useEffect, useRef, useState } from 'react'
import type { Unsubscribe, User } from 'firebase/auth'
import {
  addSharedChildNeed,
  addSharedMarketExpense,
  addSharedWish,
  loadSharedWorkspaceData,
  saveSharedMarketBudget,
  saveSharedWishesBudget,
  setSharedChildNeedCompleted,
  subscribeToMemberAccess,
  subscribeToSharedData,
  type SharedChildNeed,
  type SharedMarketBudget,
  type SharedMarketExpense,
  type SharedWish,
  type SharedWishesBudget,
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

export function useSharedModules(user: User, marketMonthKey: string, wishesMonthKey: string) {
  const [wishes, setWishes] = useState<SharedWish[]>([])
  const [wishesBudget, setWishesBudget] = useState<SharedWishesBudget | null>(null)
  const [marketBudget, setMarketBudget] = useState<SharedMarketBudget | null>(null)
  const [marketExpenses, setMarketExpenses] = useState<SharedMarketExpense[]>([])
  const [childNeeds, setChildNeeds] = useState<SharedChildNeed[]>([])
  const [isHouseholdOwner, setIsHouseholdOwner] = useState(false)
  const [permissions, setPermissions] = useState<Record<SharedModule, AccessLevel>>(noAccess)
  const [status, setStatus] = useState<SharedSyncStatus>('connecting')
  const [error, setError] = useState('')
  const householdIdRef = useRef<string | null>(null)
  const marketMonthKeyRef = useRef(marketMonthKey)
  const wishesMonthKeyRef = useRef(wishesMonthKey)
  const isHouseholdOwnerRef = useRef(false)
  const sharedRealtimeRef = useRef<Unsubscribe | null>(null)
  const memberRealtimeRef = useRef<Unsubscribe | null>(null)
  const permissionsRef = useRef(noAccess)
  marketMonthKeyRef.current = marketMonthKey
  wishesMonthKeyRef.current = wishesMonthKey

  const applyData = useCallback((data: SharedWorkspaceData) => {
    householdIdRef.current = data.householdId
    isHouseholdOwnerRef.current = data.isOwner
    permissionsRef.current = data.permissions
    setIsHouseholdOwner(data.isOwner)
    setPermissions(data.permissions)
    setWishes(data.wishes)
    setWishesBudget(data.wishesBudget)
    setMarketBudget(data.marketBudget)
    setMarketExpenses(data.marketExpenses)
    setChildNeeds(data.childNeeds)
    setStatus('synced')
    setError('')
  }, [])

  const fail = useCallback((cause: unknown) => {
    setStatus('error')
    setError(getFirebaseErrorMessage(cause, 'تعذر تحديث بيانات البيت.'))
  }, [])

  const refreshData = useCallback(async () => {
    const data = await loadSharedWorkspaceData(user, marketMonthKey, wishesMonthKey)
    if (
      marketMonthKeyRef.current === marketMonthKey
      && wishesMonthKeyRef.current === wishesMonthKey
    ) applyData(data)
    return data
  }, [applyData, marketMonthKey, user, wishesMonthKey])

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
    setWishesBudget(null)
    setMarketBudget(null)
    setMarketExpenses([])
    setChildNeeds([])

    void refreshData()
      .then((data) => {
        if (!active) return
        connectSharedRealtime(data)
        memberRealtimeRef.current = subscribeToMemberAccess(data.householdId, user.uid, () => {
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

  const saveWishesBudget = useCallback(async (budget: number) => {
    const householdId = householdIdRef.current
    if (!householdId) throw new Error('مساحة العائلة ما زالت قيد التحميل.')
    if (permissionsRef.current.wishes !== 'edit') throw new Error('صلاحيتك في الأماني للعرض فقط.')
    await saveSharedWishesBudget(householdId, user, wishesMonthKey, budget)
    await refreshData()
  }, [refreshData, user, wishesMonthKey])

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

  const addChildNeed = useCallback(async (input: { title: string; childName: string; estimatedCost: number }) => {
    const householdId = householdIdRef.current
    if (!householdId) throw new Error('مساحة العائلة ما زالت قيد التحميل.')
    if (permissionsRef.current.noor !== 'edit') throw new Error('صلاحيتك في احتياجات الأبناء للعرض فقط.')
    await addSharedChildNeed(householdId, user, input)
    await refreshData()
  }, [refreshData, user])

  const toggleChildNeed = useCallback(async (needId: string, completed: boolean) => {
    const householdId = householdIdRef.current
    if (!householdId) throw new Error('مساحة العائلة ما زالت قيد التحميل.')
    if (permissionsRef.current.noor !== 'edit') throw new Error('صلاحيتك في احتياجات الأبناء للعرض فقط.')
    await setSharedChildNeedCompleted(householdId, user, needId, completed)
    await refreshData()
  }, [refreshData, user])

  return {
    wishes,
    wishesBudget,
    marketBudget,
    marketExpenses,
    childNeeds,
    isHouseholdOwner,
    permissions,
    status,
    error,
    saveMarketBudget,
    saveWishesBudget,
    addMarketExpense,
    addWish,
    addChildNeed,
    toggleChildNeed,
  }
}
