import { useCallback, useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth, authPersistenceReady } from '../lib/firebase'
import {
  loadRushdProfile,
  signOutFromRushd,
  updateRushdProfile,
} from '../lib/householdRepository'
import { getFirebaseErrorMessage } from '../lib/firebaseErrors'

type AuthStatus = 'loading' | 'authenticated' | 'signed-out' | 'error'

export function useAuthSession() {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')

  const loadProfile = useCallback(async (activeUser: User) => {
    const profile = await loadRushdProfile(activeUser)
    setUser(activeUser)
    setDisplayName(profile.displayName)
    setStatus('authenticated')
    setError('')
  }, [])

  useEffect(() => {
    let active = true
    let unsubscribe: () => void = () => undefined

    void authPersistenceReady
      .then(() => {
        if (!active) return
        unsubscribe = onAuthStateChanged(auth, (nextUser) => {
          if (!active) return
          if (!nextUser) {
            setUser(null)
            setDisplayName('')
            setStatus('signed-out')
            setError('')
            return
          }
          setStatus('loading')
          void loadProfile(nextUser).catch((cause: unknown) => {
            if (!active) return
            setError(getFirebaseErrorMessage(cause, 'تعذر تحميل ملف المستخدم.'))
            setStatus('error')
          })
        }, (cause: unknown) => {
          if (!active) return
          setError(getFirebaseErrorMessage(cause, 'تعذر التحقق من جلسة تسجيل الدخول.'))
          setStatus('error')
        })
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(getFirebaseErrorMessage(cause, 'تعذر حفظ جلسة تسجيل الدخول على هذا الجهاز.'))
        setStatus('error')
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    const activeUser = auth.currentUser
    if (!activeUser) return
    await activeUser.reload()
    await loadProfile(activeUser)
  }, [loadProfile])

  const saveDisplayName = useCallback(async (name: string) => {
    const activeUser = auth.currentUser
    if (!activeUser) throw new Error('انتهت الجلسة. سجل الدخول مرة ثانية.')
    const nextName = await updateRushdProfile(activeUser, name)
    setDisplayName(nextName)
    setUser(activeUser)
  }, [])

  const logout = useCallback(async () => {
    await signOutFromRushd()
  }, [])

  return {
    status,
    user,
    displayName,
    error,
    refreshProfile,
    saveDisplayName,
    logout,
  }
}
