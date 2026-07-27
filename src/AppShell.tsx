import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import App from './App'
import { AuthScreen } from './components/AuthScreen'
import { NotFoundScreen } from './components/AppErrorBoundary'
import { HouseholdView } from './components/HouseholdView'
import { Icon, type IconName } from './components/Icon'
import { PromotionSimulator } from './components/PromotionSimulator'
import { WealthPlanner } from './components/WealthPlanner'
import { useAuthSession } from './hooks/useAuthSession'
import { useDialog } from './hooks/useDialog'
import { isFirebaseConfigured } from './lib/firebase'
import { getFirebaseErrorMessage } from './lib/firebaseErrors'

type LaunchTool = 'wealth' | 'promotion' | 'household'

const toolCards: Array<{
  id: LaunchTool
  icon: IconName
  title: string
  description: string
}> = [
  { id: 'wealth', icon: 'target', title: 'الثروة والأهداف', description: 'تابع محافظك وأهدافك وتوقعات النمو.' },
  { id: 'promotion', icon: 'trend', title: 'محاكي الترقية', description: 'اختبر زيادة الراتب قبل اتخاذ القرار.' },
  { id: 'household', icon: 'users', title: 'مساحة العائلة', description: 'أدر الأعضاء والصلاحيات والمشاركة.' },
]

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
  const [toolsOpen, setToolsOpen] = useState(false)
  const [householdOpen, setHouseholdOpen] = useState(false)
  const [promotionOpen, setPromotionOpen] = useState(false)
  const [wealthOpen, setWealthOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const toolsRef = useDialog<HTMLElement>(() => setToolsOpen(false), toolsOpen)
  const privacyRef = useDialog<HTMLElement>(() => setPrivacyOpen(false), privacyOpen)

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

  const user = session.user

  const openTool = (tool: LaunchTool) => {
    setToolsOpen(false)
    if (tool === 'household') setHouseholdOpen(true)
    if (tool === 'promotion') setPromotionOpen(true)
    if (tool === 'wealth') setWealthOpen(true)
  }

  const logout = async () => {
    setLogoutError('')
    setToolsOpen(false)
    setHouseholdOpen(false)
    setPromotionOpen(false)
    setWealthOpen(false)
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
      <App user={user} displayName={session.displayName} onSaveDisplayName={session.saveDisplayName} onLogout={logout} />

      <motion.button type="button" className="launch-tools-trigger" onClick={() => setToolsOpen(true)} aria-label="فتح أدوات رُشد" aria-expanded={toolsOpen} whileTap={{ scale: 0.94 }}>
        <span aria-hidden="true"><Icon name="grid" size={17} /></span><small>الأدوات</small>
      </motion.button>

      <AnimatePresence>
        {toolsOpen && (
          <motion.div className="launch-tools-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setToolsOpen(false)}>
            <motion.section
              ref={toolsRef}
              className="launch-tools-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="launch-tools-title"
              tabIndex={-1}
              initial={{ y: 90, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 90, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 330, damping: 31 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="launch-tools-handle" />
              <header>
                <div><span>اختصارات رُشد</span><h2 id="launch-tools-title">وش تبغى تفتح؟</h2></div>
                <button type="button" data-autofocus onClick={() => setToolsOpen(false)} aria-label="إغلاق الأدوات"><Icon name="close" size={20} /></button>
              </header>
              <div className="launch-tools-grid">
                {toolCards.map((tool) => (
                  <motion.button type="button" className={`launch-tool-card launch-tool-${tool.id}`} key={tool.id} onClick={() => openTool(tool.id)} whileTap={{ scale: 0.98 }}>
                    <span aria-hidden="true"><Icon name={tool.icon} size={22} /></span><div><strong>{tool.title}</strong><small>{tool.description}</small></div><b aria-hidden="true"><Icon name="arrowLeft" size={18} /></b>
                  </motion.button>
                ))}
              </div>
              <button type="button" className="tools-privacy-link" onClick={() => { setToolsOpen(false); setPrivacyOpen(true) }}><Icon name="shield" size={16} /> الخصوصية وحماية البيانات</button>
            </motion.section>
          </motion.div>
        )}

        {privacyOpen && (
          <motion.div className="privacy-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPrivacyOpen(false)}>
            <motion.section ref={privacyRef} className="privacy-dialog" role="dialog" aria-modal="true" aria-labelledby="privacy-title" tabIndex={-1} initial={{ y: 24, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: .97 }} onClick={(event) => event.stopPropagation()}>
              <button type="button" data-autofocus onClick={() => setPrivacyOpen(false)} aria-label="إغلاق"><Icon name="close" size={20} /></button>
              <span>خصوصيتك أولًا</span><h2 id="privacy-title">ما الذي يحفظه رُشد؟</h2>
              <p>يحفظ رُشد الاسم والبريد وخطط الأشهر والمصروفات والاستثمارات داخل Firebase. الراتب والمعاملات والمحافظ والأهداف وسيناريوهات الترقية خاصة بصاحب الحساب فقط.</p>
              <p>بيانات البيت المشتركة تقتصر على ميزانية السوبرماركت والأماني وسجل النشاط، وتظهر حسب صلاحية عرض أو تعديل أو بدون وصول.</p>
              <small>لا يرسل رُشد راتبك أو بريدك إلى سجلات console أو أدوات تحليلات.</small>
            </motion.section>
          </motion.div>
        )}

        {householdOpen && <HouseholdView user={user} onClose={() => setHouseholdOpen(false)} />}
        {promotionOpen && <PromotionSimulator user={user} onClose={() => setPromotionOpen(false)} />}
        {wealthOpen && <WealthPlanner user={user} onClose={() => setWealthOpen(false)} />}
      </AnimatePresence>
    </>
  )
}
