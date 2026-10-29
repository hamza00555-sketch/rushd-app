import { useEffect, useState } from 'react'
import App from './App'
import { AuthScreen } from './components/AuthScreen'
import { NotFoundScreen } from './components/AppErrorBoundary'
import { useAuthSession } from './hooks/useAuthSession'
import { isFirebaseConfigured } from './lib/firebase'
import { getFirebaseErrorMessage } from './lib/firebaseErrors'

function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}

export default function AppShell() {
  const session = useAuthSession()
  const online = useOnlineStatus()
  const [logoutError, setLogoutError] = useState('')

  if (window.location.pathname !== '/') return <NotFoundScreen />

  if (!isFirebaseConfigured) {
    return <main className="system-screen" role="alert"><div className="system-mark">!</div><h1>إعداد Firebase ناقص.</h1><p>تعذر تشغيل المصادقة وحفظ البيانات. راجع متغيرات VITE_FIREBASE في بيئة النشر.</p></main>
  }

  if (session.status === 'loading') {
    return <main className="system-screen"><span className="live-dot"/><h1>جاري فتح رُشد…</h1><p>نتحقق من جلستك المحفوظة بأمان.</p></main>
  }

  if (session.status === 'error') {
    return <main className="system-screen" role="alert"><div className="system-mark">!</div><h1>تعذر فتح حسابك.</h1><p>{session.error}</p><button type="button" onClick={() => window.location.reload()}>إعادة المحاولة</button></main>
  }

  if (!session.user) {
    return (
      <>
        {!online && <div className="offline-banner" role="status">أنت دون اتصال — تحتاج الإنترنت لتسجيل الدخول أو إنشاء حساب.</div>}
        <AuthScreen onAuthenticated={session.refreshProfile} />
      </>
    )
  }

  const logout = async () => {
    setLogoutError('')
    try {
      await session.logout()
    } catch (cause: unknown) {
      setLogoutError(getFirebaseErrorMessage(cause, 'تعذر تسجيل الخروج.'))
    }
  }

  return (
    <>
      {!online && <div className="offline-banner" role="status">أنت دون اتصال — نعرض النسخة المحفوظة وسنزامن التعديلات عند عودة الإنترنت.</div>}
      {logoutError && <div className="global-error-banner" role="alert">{logoutError}</div>}
      <App user={session.user} displayName={session.displayName} onLogout={logout} />
    </>
  )
}
