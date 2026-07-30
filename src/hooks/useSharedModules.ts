import { useCallback, useEffect, useRef, useState } from 'react'
import type { Unsubscribe, User } from 'firebase/auth'
import {
  addSharedChildNeed,
  addSharedMarketExpense,
  addSharedWish,
  loadSharedWorkspaceData,
  resetSharedWishSavings,
  saveSharedMarketBudget,
  saveSharedMarketCycleStartDay,
  saveSharedWishesBudget,
  setSharedChildNeedCompleted,
  subscribeToMemberAccess,
  subscribeToSharedData,
  updateSharedWishFundingLevel,
  type SharedChildNeed,
  type SharedMarketBudget,
  type SharedMarketExpense,
  type SharedWish,
  type SharedWishesBudget,
  type SharedWorkspaceData,
} from '../lib/householdRepository'
import type { AccessLevel, SharedModule } from '../lib/household'
import { getFirebaseErrorMessage } from '../lib/firebaseErrors'
import type { WishFundingLevel } from '../lib/wishesFund'

export type SharedSyncStatus = 'connecting' | 'synced' | 'error'

const noAccess: Record<SharedModule, AccessLevel> = {
  market: 'none',
  wishes: 'none',
  noor: 'none',
}

export function useSharedModules(user: User, marketMonthKey: string, wishesMonthKey: string) {
  const [wishes, setWishes] = useState<SharedWish[]>([])
  const [wishesBudget, setWishesBudget] = useState<SharedWishesBudget | null>(null)
  const [wishesReserveBalance, setWishesReserveBalance] = useState(0)
  const [marketBudget, setMarketBudget] = useState<SharedMarketBudget | null>(null)
  const [marketExpenses, setMarketExpenses] = useState<SharedMarketExpense[]>([])
  const [marketCycleStartDay, setMarketCycleStartDay] = useState(1)
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
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshInFlightRef = useRef(false)
  const refreshPendingRef = useRef(false)
  const refreshRunnerRef = useRef<() => void>(() => undefined)
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
    setWishesReserveBalance(data.wishesReserveBalance)
    setMarketBudget(data.marketBudget)
    setMarketExpenses(data.marketExpenses)
    setMarketCycleStartDay(data.marketCycleStartDay)
    setChildNeeds(data.childNeeds)
    setStatus('synced')
    setError('')
  }, [])

  const fail = useCallback((cause: unknown) => {
    setStatus('error')
    setError(getFirebaseErrorMessage(cause, 'تعذر تحديث بيانات البيت.'))
  }, [])

  const refreshData = useCallback(async () => {
    const data = await loadSharedWorkspaceData(
      user,
      marketMonthKey,
      wishesMonthKey,
      householdIdRef.current ?? undefined,
    )
    if (
      marketMonthKeyRef.current === marketMonthKey
      && wishesMonthKeyRef.current === wishesMonthKey
    ) applyData(data)
    return data
  }, [applyData, marketMonthKey, user, wishesMonthKey])

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null
      refreshRunnerRef.current()
    }, 70)
  }, [])

  const runRefresh = useCallback(async () => {
    if (refreshInFlightRef.current) {
      refreshPendingRef.current = true
      return
    }
    refreshInFlightRef.current = true
    try {
      await refreshData()
    } catch (cause) {
      fail(cause)
    } finally {
      refreshInFlightRef.current = false
      if (refreshPendingRef.current) {
        refreshPendingRef.current = false
        scheduleRefresh()
      }
    }
  }, [fail, refreshData, scheduleRefresh])
  refreshRunnerRef.current = () => void runRefresh()

  const connectSharedRealtime = useCallback((data: SharedWorkspaceData) => {
    sharedRealtimeRef.current?.()
    sharedRealtimeRef.current = subscribeToSharedData(
      data.householdId,
      data.permissions,
      marketMonthKey,
      scheduleRefresh,
      fail,
    )
  }, [fail, marketMonthKey, scheduleRefresh])

  useEffect(() => {
    let active = true
    if (!householdIdRef.current) {
      setStatus('connecting')
      setError('')
      setWishes([])
      setWishesBudget(null)
      setWishesReserveBalance(0)
      setMarketBudget(null)
      setMarketExpenses([])
      setChildNeeds([])
    }

    void refreshData()
      .then((data) => {
        if (!active) return
        connectSharedRealtime(data)
        let memberSnapshotReady = false
        memberRealtimeRef.current = subscribeToMemberAccess(data.householdId, user.uid, () => {
          if (!memberSnapshotReady) {
            memberSnapshotReady = true
            return
          }
          void refreshData().then((nextData) => {
            if (active) connectSharedRealtime(nextData)
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
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [connectSharedRealtime, fail, refreshData, user.uid])

  const saveMarketBudget = useCallback(async (budget: number) => {
    const householdId = householdIdRef.current
    if (!householdId) throw new Error('مساحة العائلة ما زالت قيد التحميل.')
    if (!isHouseholdOwnerRef.current) throw new Error('رب الأسرة فقط يقدر يحدد ميزانية السوبرماركت.')
    await saveSharedMarketBudget(householdId, user, marketMonthKey, budget)
    scheduleRefresh()
  }, [marketMonthKey, scheduleRefresh, user])

  const saveMarketCycleStartDay = useCallback(async (startDay: number) => {
    const householdId = householdIdRef.current
    if (!householdId) throw new Error('مساحة العائلة ما زالت قيد التحميل.')
    if (!isHouseholdOwnerRef.current) throw new Error('رب الأسرة فقط يقدر يحدد بداية شهر السوبرماركت.')
    await saveSharedMarketCycleStartDay(householdId, user, startDay)
    scheduleRefresh()
  }, [scheduleRefresh, user])

  const saveWishesBudget = useCallback(async (contribution: number) => {
    const householdId = householdIdRef.current
    if (!householdId) throw new Error('مساحة العائلة ما زالت قيد التحميل.')
    if (permissionsRef.current.wishes !== 'edit') throw new Error('صلاحيتك في الأماني للعرض فقط.')
    await saveSharedWishesBudget(householdId, user, wishesMonthKey, contribution)
    scheduleRefresh()
  }, [scheduleRefresh, user, wishesMonthKey])

  const addMarketExpense = useCallback(async (amount: number, title: string) => {
    const householdId = householdIdRef.current
    if (!householdId) throw new Error('مساحة العائلة ما زالت قيد التحميل.')
    if (permissionsRef.current.market !== 'edit') throw new Error('صلاحيتك في السوبرماركت للعرض فقط.')
    if (!marketBudget || marketBudget.monthKey !== marketMonthKey) {
      throw new Error('حدّد ميزانية الشهر قبل تسجيل أي مشتريات.')
    }
    await addSharedMarketExpense(householdId, user, marketMonthKey, amount, title)
    scheduleRefresh()
  }, [marketBudget, marketMonthKey, scheduleRefresh, user])

  const addWish = useCallback(async (input: {
    title: string
    icon: string
    target: number
    deadline: string
    fundingLevel: WishFundingLevel
  }) => {
    const householdId = householdIdRef.current
    if (!householdId) throw new Error('مساحة العائلة ما زالت قيد التحميل.')
    if (permissionsRef.current.wishes !== 'edit') throw new Error('صلاحيتك في الأماني للعرض فقط.')
    await addSharedWish(householdId, user, input)
    scheduleRefresh()
  }, [scheduleRefresh, user])

  const updateWishFundingLevel = useCallback(async (
    wishId: string,
    fundingLevel: WishFundingLevel,
  ) => {
    const householdId = householdIdRef.current
    if (!householdId) throw new Error('مساحة العائلة ما زالت قيد التحميل.')
    if (permissionsRef.current.wishes !== 'edit') throw new Error('صلاحيتك في الأماني للعرض فقط.')
    await updateSharedWishFundingLevel(householdId, user, wishId, fundingLevel)
    scheduleRefresh()
  }, [scheduleRefresh, user])

  const resetWishSavings = useCallback(async (wishId: string) => {
    const householdId = householdIdRef.current
    if (!householdId) throw new Error('مساحة العائلة ما زالت قيد التحميل.')
    if (permissionsRef.current.wishes !== 'edit') throw new Error('صلاحيتك في الأماني للعرض فقط.')
    const returnedAmount = await resetSharedWishSavings(householdId, user, wishId)
    scheduleRefresh()
    return returnedAmount
  }, [scheduleRefresh, user])

  const addChildNeed = useCallback(async (input: {
    title: string
    childName: string
    estimatedCost: number
  }) => {
    const householdId = householdIdRef.current
    if (!householdId) throw new Error('مساحة العائلة ما زالت قيد التحميل.')
    if (permissionsRef.current.noor !== 'edit') throw new Error('صلاحيتك في احتياجات الأبناء للعرض فقط.')
    await addSharedChildNeed(householdId, user, input)
    scheduleRefresh()
  }, [scheduleRefresh, user])

  const toggleChildNeed = useCallback(async (needId: string, completed: boolean) => {
    const householdId = householdIdRef.current
    if (!householdId) throw new Error('مساحة العائلة ما زالت قيد التحميل.')
    if (permissionsRef.current.noor !== 'edit') throw new Error('صلاحيتك في احتياجات الأبناء للعرض فقط.')
    await setSharedChildNeedCompleted(householdId, user, needId, completed)
    scheduleRefresh()
  }, [scheduleRefresh, user])

  return {
    wishes,
    wishesBudget,
    wishesReserveBalance,
    marketBudget,
    marketExpenses,
    marketCycleStartDay,
    childNeeds,
    isHouseholdOwner,
    permissions,
    status,
    error,
    saveMarketBudget,
    saveMarketCycleStartDay,
    saveWishesBudget,
    addMarketExpense,
    addWish,
    updateWishFundingLevel,
    resetWishSavings,
    addChildNeed,
    toggleChildNeed,
  }
}
