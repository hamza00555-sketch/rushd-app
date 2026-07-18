import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel, User } from '@supabase/supabase-js'
import {
  addSharedMarketItem,
  addSharedWish,
  isSupabaseConfigured,
  loadSharedWorkspaceData,
  subscribeToSharedData,
  toggleSharedMarketItem,
  type SharedMarketItem,
  type SharedWish,
} from '../lib/householdRepository'
import { supabase } from '../lib/supabase'

export type SharedSyncStatus = 'demo' | 'connecting' | 'signed-out' | 'synced' | 'error'

const demoWishes: SharedWish[] = [
  { id: 'wish-trip', title: 'رحلة العائلة', icon: '✈️', saved: 12000, target: 20000, deadline: 'باقي 3 أشهر', owner: 'العائلة' },
  { id: 'wish-home', title: 'تأثيث البيت', icon: '🛋️', saved: 18500, target: 35000, deadline: 'باقي 7 أشهر', owner: 'حمزة' },
  { id: 'wish-emergency', title: 'صندوق الطوارئ', icon: '🛡️', saved: 15000, target: 20000, deadline: 'قريب جدًا', owner: 'حمزة' },
]

const demoMarketItems: SharedMarketItem[] = [
  { id: 'market-milk', title: 'حليب', quantity: '2 عبوة', owner: 'أسماء', checked: false },
  { id: 'market-eggs', title: 'بيض', quantity: 'طبق كبير', owner: 'حمزة', checked: true },
  { id: 'market-tissues', title: 'مناديل مطبخ', quantity: '1 كرتون', owner: 'أسماء', checked: false },
  { id: 'market-coffee', title: 'قهوة', quantity: '500 جم', owner: 'حمزة', checked: false },
]

export function useSharedModules() {
  const [wishes, setWishes] = useState<SharedWish[]>(demoWishes)
  const [marketItems, setMarketItems] = useState<SharedMarketItem[]>(demoMarketItems)
  const [status, setStatus] = useState<SharedSyncStatus>(isSupabaseConfigured ? 'connecting' : 'demo')
  const [error, setError] = useState('')
  const userRef = useRef<User | null>(null)
  const householdIdRef = useRef<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const stopRealtime = useCallback(() => {
    if (channelRef.current && supabase) supabase.removeChannel(channelRef.current)
    channelRef.current = null
  }, [])

  const refresh = useCallback(async (user: User) => {
    const data = await loadSharedWorkspaceData(user)
    userRef.current = user
    householdIdRef.current = data.householdId
    setWishes(data.wishes)
    setMarketItems(data.marketItems)
    setStatus('synced')
    setError('')

    if (!channelRef.current) {
      channelRef.current = subscribeToSharedData(data.householdId, () => {
        const activeUser = userRef.current
        if (!activeUser) return
        void loadSharedWorkspaceData(activeUser)
          .then((next) => {
            setWishes(next.wishes)
            setMarketItems(next.marketItems)
            setStatus('synced')
          })
          .catch((cause: unknown) => {
            setStatus('error')
            setError(cause instanceof Error ? cause.message : 'تعذر تحديث البيانات المشتركة.')
          })
      })
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    let active = true

    const connect = async (user: User | null) => {
      stopRealtime()
      userRef.current = user
      householdIdRef.current = null
      if (!user) {
        if (!active) return
        setStatus('signed-out')
        setWishes([])
        setMarketItems([])
        return
      }

      if (active) setStatus('connecting')
      try {
        await refresh(user)
      } catch (cause: unknown) {
        if (!active) return
        setStatus('error')
        setError(cause instanceof Error ? cause.message : 'تعذر الاتصال ببيانات البيت.')
      }
    }

    void supabase.auth.getSession().then(({ data }) => connect(data.session?.user ?? null))
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void connect(session?.user ?? null)
    })

    return () => {
      active = false
      authListener.subscription.unsubscribe()
      stopRealtime()
    }
  }, [refresh, stopRealtime])

  const addMarket = useCallback(async (title = 'عنصر جديد', quantity = 'حدد الكمية') => {
    if (!isSupabaseConfigured) {
      setMarketItems((current) => [...current, { id: `demo-${Date.now()}`, title, quantity, owner: 'حمزة', checked: false }])
      return
    }
    const user = userRef.current
    const householdId = householdIdRef.current
    if (!user || !householdId) throw new Error('سجل الدخول من مساحة العائلة أولًا.')
    await addSharedMarketItem(householdId, user, title, quantity)
    await refresh(user)
  }, [refresh])

  const toggleMarket = useCallback(async (item: SharedMarketItem) => {
    if (!isSupabaseConfigured) {
      setMarketItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, checked: !candidate.checked } : candidate))
      return
    }
    const user = userRef.current
    const householdId = householdIdRef.current
    if (!user || !householdId) throw new Error('سجل الدخول من مساحة العائلة أولًا.')
    await toggleSharedMarketItem(householdId, user, item)
    await refresh(user)
  }, [refresh])

  const addWish = useCallback(async () => {
    const wish = { title: 'جهاز جديد', icon: '💻', target: 8000, deadline: 'هدف جديد' }
    if (!isSupabaseConfigured) {
      setWishes((current) => [...current, { id: `demo-${Date.now()}`, ...wish, saved: 0, owner: 'حمزة' }])
      return
    }
    const user = userRef.current
    const householdId = householdIdRef.current
    if (!user || !householdId) throw new Error('سجل الدخول من مساحة العائلة أولًا.')
    await addSharedWish(householdId, user, wish)
    await refresh(user)
  }, [refresh])

  return {
    wishes,
    marketItems,
    status,
    error,
    addMarket,
    toggleMarket,
    addWish,
  }
}
