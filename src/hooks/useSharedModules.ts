import { useCallback, useEffect, useRef, useState } from 'react'
import type { Unsubscribe, User } from 'firebase/auth'
import {
  addSharedMarketItem,
  addSharedWish,
  loadSharedWorkspaceData,
  subscribeToMemberAccess,
  subscribeToSharedData,
  toggleSharedMarketItem,
  type SharedMarketItem,
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

export function useSharedModules(user: User) {
  const [wishes, setWishes] = useState<SharedWish[]>([])
  const [marketItems, setMarketItems] = useState<SharedMarketItem[]>([])
  const [permissions, setPermissions] = useState<Record<SharedModule, AccessLevel>>(noAccess)
  const [status, setStatus] = useState<SharedSyncStatus>('connecting')
  const [error, setError] = useState('')
  const householdIdRef = useRef<string | null>(null)
  const sharedRealtimeRef = useRef<Unsubscribe | null>(null)
  const memberRealtimeRef = useRef<Unsubscribe | null>(null)
  const permissionsRef = useRef(noAccess)

  const applyData = useCallback((data: SharedWorkspaceData) => {
    householdIdRef.current = data.householdId
    permissionsRef.current = data.permissions
    setPermissions(data.permissions)
    setWishes(data.wishes)
    setMarketItems(data.marketItems)
    setStatus('synced')
    setError('')
  }, [])

  const fail = useCallback((cause: unknown) => {
    setStatus('error')
    setError(getFirebaseErrorMessage(cause, 'تعذر تحديث بيانات البيت.'))
  }, [])

  const refreshData = useCallback(async () => {
    const data = await loadSharedWorkspaceData(user)
    applyData(data)
    return data
  }, [applyData, user])

  const connectSharedRealtime = useCallback((data: SharedWorkspaceData) => {
    sharedRealtimeRef.current?.()
    sharedRealtimeRef.current = subscribeToSharedData(data.householdId, data.permissions, () => {
      void refreshData().catch(fail)
    }, fail)
  }, [fail, refreshData])

  useEffect(() => {
    let active = true
    setStatus('connecting')
    setError('')
    setWishes([])
    setMarketItems([])

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

  const addMarket = useCallback(async (title: string, quantity: string) => {
    const householdId = householdIdRef.current
    if (!householdId) throw new Error('مساحة العائلة ما زالت قيد التحميل.')
    if (permissionsRef.current.market !== 'edit') throw new Error('صلاحيتك في السوبرماركت للعرض فقط.')
    await addSharedMarketItem(householdId, user, title, quantity)
    await refreshData()
  }, [refreshData, user])

  const toggleMarket = useCallback(async (item: SharedMarketItem) => {
    const householdId = householdIdRef.current
    if (!householdId) throw new Error('مساحة العائلة ما زالت قيد التحميل.')
    if (permissionsRef.current.market !== 'edit') throw new Error('صلاحيتك في السوبرماركت للعرض فقط.')
    await toggleSharedMarketItem(householdId, user, item)
    await refreshData()
  }, [refreshData, user])

  const addWish = useCallback(async (input: { title: string; icon: string; target: number; deadline: string }) => {
    const householdId = householdIdRef.current
    if (!householdId) throw new Error('مساحة العائلة ما زالت قيد التحميل.')
    if (permissionsRef.current.wishes !== 'edit') throw new Error('صلاحيتك في الأماني للعرض فقط.')
    await addSharedWish(householdId, user, input)
    await refreshData()
  }, [refreshData, user])

  return {
    wishes,
    marketItems,
    permissions,
    status,
    error,
    addMarket,
    toggleMarket,
    addWish,
  }
}
