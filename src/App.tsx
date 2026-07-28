import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { User } from 'firebase/auth'
import { Icon, type IconName } from './components/Icon'
import { RushdCharacter } from './components/RushdCharacter'
import { useSharedModules, type SharedSyncStatus } from './hooks/useSharedModules'
import { useMonthlyPlan, type RatibiSyncState } from './hooks/useMonthlyPlan'
import { formatSar, getSpentPercentage } from './lib/finance'
import {
  getFinancialSignals,
  getFinancialSnapshot,
  type BudgetCategory,
} from './lib/financialEngine'
import {
  formatMonthLabel,
  getCurrentMonthKey,
  type MonthlyPlan,
} from './lib/monthlyPlanRepository'
import type { AccessLevel } from './lib/household'
import type { SharedMarketBudget, SharedMarketExpense, SharedWish } from './lib/householdRepository'
import {
  getRatibiIncomeTotal,
  getRatibiWishesBudget,
  parseRatibiBundle,
  type RatibiBudget,
  type RatibiFinanceBundleV1,
} from './lib/ratibiImport'

type Tab = 'home' | 'month' | 'wishes' | 'market'

type AppProps = {
  user: User
  displayName: string
  onLogout: () => Promise<void>
}

const tabMessages: Record<Tab, string> = {
  home: 'هذه قراءة شهرِك الحالي، وكل رقم هنا محفوظ في حسابك الخاص.',
  month: 'اربط راتبي مرة واحدة، وبعدها تصل تحديثاتك هنا تلقائيًا.',
  wishes: 'كل أمنية مشتركة هنا مرتبطة بالبيت، مو بحسابك المالي الخاص.',
  market: 'كل مشتريات السوبرماركت تنخصم فورًا، والمتبقي واضح لكل شخص عنده صلاحية.',
}

const RATIBI_APP_URL = import.meta.env.VITE_RATIBI_APP_URL || 'https://ratebi-salary-app2.vercel.app'

const categoryIcons: Record<string, IconName> = {
  needs: 'home',
  commitments: 'receipt',
  future: 'shield',
  flex: 'spark',
}

const parseCurrencyInput = (input: string) => {
  const normalized = input
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[٬,\s]/g, '')
    .replace('٫', '.')
  return Number(normalized)
}

const formatMarketSar = (value: number) =>
  new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 }).format(value)

const syncMessage = (status: SharedSyncStatus, error: string) => {
  if (status === 'synced') return { title: 'متصل لحظيًا', body: 'أي تعديل يظهر لأعضاء البيت مباشرة.' }
  if (status === 'connecting') return { title: 'جاري المزامنة', body: 'رُشد يحمّل آخر تحديثات البيت.' }
  return { title: 'تعذر التحديث', body: error || 'تحقق من الاتصال وحاول مرة ثانية.' }
}

const greeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'صباح الخير'
  if (hour < 18) return 'مساء الخير'
  return 'ليلة هادئة'
}

function ProgressBar({ value, tone = 'default' }: { value: number; tone?: string }) {
  return (
    <div className={`goal-track ${tone}`} aria-label={`التقدم ${value}%`}>
      <motion.i initial={{ width: 0 }} animate={{ width: `${Math.min(100, value)}%` }} transition={{ duration: 0.65 }} />
    </div>
  )
}

function HomeView({
  salary,
  categories,
  wishes,
  marketRemaining,
  onOpenMonth,
}: {
  salary: number
  categories: BudgetCategory[]
  wishes: SharedWish[]
  marketRemaining: number | null
  onOpenMonth: () => void
}) {
  const snapshot = getFinancialSnapshot(salary, categories)
  const signals = getFinancialSignals(salary, categories)
  const nearestWish = [...wishes].sort((a, b) => (b.saved / Math.max(1, b.target)) - (a.saved / Math.max(1, a.target)))[0]
  const wishProgress = nearestWish ? getSpentPercentage(nearestWish.saved, nearestWish.target) : 0

  return (
    <motion.main className="screen-content" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <section className="financial-hero">
        <div className="hero-copy">
          <span>المتبقي من راتبك</span>
          <strong>{formatSar(snapshot.remaining)} <small>ريال</small></strong>
          <p>استخدمت {snapshot.utilization}% من دخل هذا الشهر، ومؤشر رُشد عند {snapshot.score}%.</p>
        </div>
        <motion.div className="health-score" animate={{ y: [0, -5, 0] }} transition={{ duration: 3.8, repeat: Infinity }}>
          <b>{snapshot.score}</b>
          <span>مؤشر رُشد</span>
        </motion.div>
        <button type="button" className="hero-action" onClick={onOpenMonth}>فتح حساب الشهر <Icon name="arrowLeft" size={16} /></button>
      </section>

      <section className="financial-metrics">
        <article><span>المصروف</span><strong>{formatSar(snapshot.spent)}</strong><small>من {formatSar(salary)} ريال</small></article>
        <article><span>للمستقبل</span><strong>{snapshot.futureRate}%</strong><small>استثمار وأمان</small></article>
        <article className={snapshot.watch ? 'metric-watch' : ''}><span>تحتاج متابعة</span><strong>{snapshot.watch}</strong><small>فئات هذا الشهر</small></article>
      </section>

      <section className="section-block intelligence-card">
        <div className="section-title"><div><span>قراءة رُشد</span><h2>ما الذي يحتاج قرارك؟</h2></div><i className="thinking-dot"><Icon name="spark" size={18} /></i></div>
        <div className="signal-list">
          {signals.map((signal, index) => (
            <motion.article className={`signal-row signal-${signal.level}`} key={signal.title} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }}>
              <span><Icon name={signal.level === 'danger' ? 'alert' : signal.level === 'watch' ? 'clock' : 'check'} size={17} /></span>
              <div><strong>{signal.title}</strong><p>{signal.body}</p></div>
            </motion.article>
          ))}
        </div>
      </section>

      {nearestWish ? (
        <section className="section-block">
          <div className="section-title"><div><span>الأقرب الآن</span><h2>{nearestWish.title}</h2></div><b>{wishProgress}%</b></div>
          <div className="goal-focus-row"><span className="goal-art"><Icon name="heart" size={24} /></span><div><strong>{formatSar(nearestWish.saved)} من {formatSar(nearestWish.target)} ريال</strong><ProgressBar value={wishProgress}/><small>{nearestWish.deadline}</small></div></div>
        </section>
      ) : (
        <section className="section-block empty-module-card"><span><Icon name="heart" size={22} /></span><div><strong>لا توجد أمنية مشتركة</strong><p>أضف أول أمنية من صفحة أماني رُشد.</p></div></section>
      )}

      <section className="living-summary">
        <motion.span animate={{ rotate: [0, 18, 0], scale: [1, 1.12, 1] }} transition={{ duration: 2.8, repeat: Infinity }}><Icon name="spark" size={23} /></motion.span>
        <div>
          <strong>ملخص البيت</strong>
          <p>{marketRemaining === null ? 'ميزانية السوبرماركت لهذا الشهر لم تُحدّد بعد.' : marketRemaining >= 0 ? `باقي ${formatMarketSar(marketRemaining)} ريال من ميزانية السوبرماركت.` : `ميزانية السوبرماركت متجاوزة بـ ${formatMarketSar(Math.abs(marketRemaining))} ريال.`}</p>
        </div>
      </section>
    </motion.main>
  )
}

function EmptyHomeView({ onOpenMonth }: { onOpenMonth: () => void }) {
  return (
    <motion.main className="screen-content" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <section className="financial-hero empty-financial-hero">
        <div className="hero-copy">
          <span>رُشد + راتبي</span>
          <strong>بياناتك لسه ما وصلت.</strong>
          <p>اربط راتبي بنفس حسابك مرة واحدة، وبعدها رُشد يرتب الالتزامات والأهداف والميزانيات تلقائيًا.</p>
        </div>
        <motion.div className="health-score empty-score" animate={{ y: [0, -5, 0] }} transition={{ duration: 3.8, repeat: Infinity }}>
          <Icon name="spark" size={28} />
          <span>جاهز للربط</span>
        </motion.div>
        <button type="button" className="hero-action" onClick={onOpenMonth}>فتح حساب الشهر <Icon name="arrowLeft" size={16} /></button>
      </section>

      <section className="section-block ratibi-empty-explainer">
        <div className="section-title"><div><span>مرة واحدة</span><h2>كيف يبدأ الربط؟</h2></div></div>
        <div><span>١</span><p>افتح راتبي وسجّل الدخول بنفس حساب رُشد.</p></div>
        <div><span>٢</span><p>اضغط «ربط رُشد» أول مرة فقط.</p></div>
        <div><span>٣</span><p>بعدها تصل التحديثات وتترتب هنا بدون نسخ أو لصق.</p></div>
      </section>
    </motion.main>
  )
}

function MonthView({
  plan,
  onImport,
  saving,
  ratibiSync,
}: {
  plan: MonthlyPlan | null
  onImport: (bundle: RatibiFinanceBundleV1) => Promise<void>
  saving: boolean
  ratibiSync: RatibiSyncState
}) {
  const [pasteValue, setPasteValue] = useState('')
  const [importError, setImportError] = useState('')
  const [importNotice, setImportNotice] = useState('')
  const bundle = plan?.ratibi ?? null
  const snapshot = plan ? getFinancialSnapshot(plan.salary, plan.categories) : null
  const connected = ratibiSync.status === 'connected'
  const connectionTitle = connected
    ? 'متصل مباشرة بتطبيق راتبي'
    : ratibiSync.status === 'syncing'
      ? 'وصل تحديث من راتبي'
      : ratibiSync.status === 'error'
        ? 'الربط يحتاج مراجعة'
        : 'بانتظار ربط تطبيق راتبي'
  const syncLabel = plan?.hasPendingWrites || ratibiSync.status === 'syncing'
    ? 'جاري ترتيب وحفظ آخر تحديث…'
    : ratibiSync.status === 'connecting'
      ? 'جاري البحث عن اتصال راتبي…'
      : ratibiSync.status === 'waiting'
        ? 'لم تصل مزامنة من راتبي لهذا الشهر بعد'
        : ratibiSync.status === 'error'
          ? ratibiSync.error
          : ratibiSync.lastExportedAt
            ? `آخر مزامنة ${new Date(ratibiSync.lastExportedAt).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })}`
            : plan?.fromCache
              ? 'نسخة محفوظة على الجهاز'
              : 'متصل'

  const importText = async (value: string) => {
    setImportError('')
    setImportNotice('')
    try {
      const nextBundle = parseRatibiBundle(value)
      await onImport(nextBundle)
      setPasteValue('')
      setImportNotice(`تم استيراد ${formatMonthLabel(nextBundle.month)} يدويًا كنسخة احتياطية.`)
      return true
    } catch (cause: unknown) {
      setImportError(cause instanceof Error ? cause.message : 'تعذر استيراد بيانات راتبي.')
      return false
    }
  }

  const submitPastedBundle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void importText(pasteValue)
  }

  return (
    <motion.main className="screen-content" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
      <section className="ratibi-import-card">
        <div className="ratibi-connection-state">
          <span><Icon name={connected ? 'check' : 'spark'} size={16} /></span>
          <b>{connectionTitle}</b>
        </div>
        <span>ملخص الشهر</span>
        <h1>{bundle ? `${formatMonthLabel(bundle.month)} مرتّب وجاهز.` : 'بياناتك تبدأ من راتبي، مو من إدخالات جديدة.'}</h1>
        <p>{bundle
          ? connected
            ? 'أي تعديل تحفظه في راتبي يصل إلى رُشد تلقائيًا، وتبقى هذه الصفحة للقراءة والترتيب فقط.'
            : 'هذه آخر نسخة محفوظة. أكمل الربط المباشر حتى تصل تحديثات راتبي تلقائيًا.'
          : 'افتح راتبي وسجّل الدخول بنفس حساب رُشد، ثم اربط التطبيقين مرة واحدة.'}</p>
        <a className="ratibi-import-button" href={`${RATIBI_APP_URL}?connect=rushd`} target="_blank" rel="noreferrer">
          <Icon name="spark" size={19} />
          {connected ? 'فتح راتبي لإدارة بياناتي' : 'فتح راتبي وإكمال الربط'}
        </a>
        <small><Icon name="shield" size={14} /> المزامنة خاصة بحسابك؛ لا نضع أرقامك في الرابط أو الحافظة.</small>
        <div className="ratibi-sync-label">{syncLabel}</div>
      </section>

      {importNotice && <div className="ratibi-import-notice" role="status"><Icon name="check" size={17} /> {importNotice}</div>}
      {importError && <div className="inline-form-error ratibi-import-error" role="alert">{importError}</div>}
      {ratibiSync.status === 'error' && <div className="inline-form-error ratibi-import-error" role="alert">{ratibiSync.error}</div>}

      <details className="ratibi-manual-fallback">
        <summary>استيراد يدوي احتياطي</summary>
        <form className="ratibi-paste-card" onSubmit={submitPastedBundle}>
          <div><strong>استخدمه فقط إذا تعذر الربط المباشر</strong></div>
          <p>الصق حزمة JSON الكاملة من راتبي، ثم اعتمد الاستيراد.</p>
          <textarea dir="ltr" value={pasteValue} onChange={(event) => setPasteValue(event.target.value)} placeholder='{"schema":"ratibi.rushd.finance",...}' aria-label="بيانات راتبي بصيغة JSON" />
          <button type="submit" disabled={saving || !pasteValue.trim()}>{saving ? 'جاري الاستيراد…' : 'اعتماد النسخة الاحتياطية'}</button>
        </form>
      </details>

      {plan && snapshot && (
        <>
          <section className="ratibi-summary-grid" aria-label="ملخص بيانات الشهر">
            <article><span>إجمالي الدخل</span><strong>{formatSar(bundle ? getRatibiIncomeTotal(bundle) : plan.salary)}</strong><small>ريال</small></article>
            <article><span>المستخدم</span><strong>{formatSar(snapshot.spent)}</strong><small>{snapshot.utilization}% من الدخل</small></article>
            <article><span>المتبقي</span><strong>{formatSar(snapshot.remaining)}</strong><small>ريال</small></article>
          </section>

          <section className="section-block">
            <div className="section-title"><div><span>التوزيع</span><h2>ميزانيات الشهر</h2></div><span className={`plan-status ${snapshot.overspent ? 'danger' : ''}`}>{snapshot.overspent ? 'يحتاج انتباه' : 'مرتب'}</span></div>
            <div className="budget-category-list">
              {plan.categories.map((category, index) => {
                const usage = getSpentPercentage(category.spent, category.limit)
                const status = category.spent > category.limit ? 'danger' : usage >= 80 ? 'watch' : 'good'
                return (
                  <motion.article className={`budget-category ${status}`} key={category.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                    <span className={`category-icon ${category.tone}`}><Icon name={categoryIcons[category.id] ?? 'wallet'} size={20} /></span>
                    <div className="category-body">
                      <div><strong>{category.title}</strong><b>{formatSar(category.spent)} / {formatSar(category.limit)}</b></div>
                      <ProgressBar value={usage} tone={status}/>
                      <small>{status === 'danger' ? `تجاوزت بـ ${formatSar(category.spent - category.limit)} ريال` : `متبقي ${formatSar(Math.max(0, category.limit - category.spent))} ريال`}</small>
                    </div>
                  </motion.article>
                )
              })}
            </div>
          </section>

          {bundle && bundle.obligations.length > 0 && (
            <section className="section-block ratibi-detail-section">
              <div className="section-title"><div><span>من راتبي</span><h2>الالتزامات</h2></div><b>{bundle.obligations.length}</b></div>
              <div className="ratibi-detail-list">
                {bundle.obligations.map((item) => {
                  const paid = item.amount <= 0 ? 0 : Math.round((item.paidAmount / item.amount) * 100)
                  return <article key={item.id}><span><Icon name={paid >= 100 ? 'check' : 'receipt'} size={18} /></span><div><strong>{item.title}</strong><small>{item.dueDate ? new Date(item.dueDate).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' }) : 'بدون موعد محدد'}</small><ProgressBar value={paid}/></div><b>{formatSar(item.paidAmount)} / {formatSar(item.amount)}</b></article>
                })}
              </div>
            </section>
          )}

          {bundle && bundle.goals.length > 0 && (
            <section className="section-block ratibi-detail-section">
              <div className="section-title"><div><span>من راتبي</span><h2>الأهداف</h2></div><b>{bundle.goals.length}</b></div>
              <div className="ratibi-detail-list">
                {bundle.goals.map((goal) => {
                  const progress = goal.target <= 0 ? 0 : Math.round((goal.saved / goal.target) * 100)
                  return <article key={goal.id}><span><Icon name="target" size={18} /></span><div><strong>{goal.title}</strong><small>مخصص الشهر {formatSar(goal.monthlyAllocation)} ريال</small><ProgressBar value={progress}/></div><b>{progress}%</b></article>
                })}
              </div>
            </section>
          )}

          {bundle && bundle.accounts.length > 0 && (
            <section className="section-block ratibi-detail-section">
              <div className="section-title"><div><span>من راتبي</span><h2>الحسابات</h2></div><b>{bundle.accounts.length}</b></div>
              <div className="ratibi-account-grid">
                {bundle.accounts.map((account) => <article key={account.id}><span><Icon name="wallet" size={18} /></span><div><strong>{account.title}</strong><small>{account.type}</small></div>{account.balance != null && <b>{formatSar(account.balance)} ريال</b>}</article>)}
              </div>
            </section>
          )}

          {bundle && bundle.transactions.length > 0 && (
            <section className="section-block transaction-section">
              <div className="section-title"><div><span>من راتبي</span><h2>آخر الحركات</h2></div><b>{bundle.transactions.length}</b></div>
              {bundle.transactions.slice(0, 12).map((transaction) => (
                <article className="transaction-row" key={transaction.id}><span className="transaction-icon"><Icon name="receipt" size={18} /></span><div><strong>{transaction.title}</strong><small>{transaction.category || 'بدون فئة'} · {new Date(transaction.occurredAt).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}</small></div><b>-{formatSar(transaction.amount)}</b></article>
              ))}
            </section>
          )}
        </>
      )}
    </motion.main>
  )
}

function WishesView({
  wishes,
  monthlyBudget,
  onAdd,
  access,
  syncStatus,
  syncError,
}: {
  wishes: SharedWish[]
  monthlyBudget: RatibiBudget | null
  onAdd: (input: { title: string; icon: string; target: number; deadline: string }) => Promise<void>
  access: AccessLevel
  syncStatus: SharedSyncStatus
  syncError: string
}) {
  const sync = syncMessage(syncStatus, syncError)
  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = Number(target)
    if (!title.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('اكتب اسم الأمنية والمبلغ المستهدف.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onAdd({ title: title.trim(), icon: '♡', target: amount, deadline: deadline.trim() || 'بدون موعد' })
      setTitle('')
      setTarget('')
      setDeadline('')
      setFormOpen(false)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'تعذرت إضافة الأمنية.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.main className="screen-content" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
      <section className="goal-intro wishes-intro"><span>أماني رُشد</span><h1>حوّل الأشياء اللي تتمناها إلى خطة واضحة.</h1><p>الأماني المشتركة فقط تظهر لأعضاء البيت. أهدافك الخاصة تبقى لك.</p></section>
      {monthlyBudget && (
        <section className="wish-monthly-budget">
          <div><span>ميزانية الأماني من راتبي</span><strong>{formatSar(Math.max(0, monthlyBudget.limit - monthlyBudget.spent))} ريال</strong><small>متبقي من {formatSar(monthlyBudget.limit)} ريال هذا الشهر</small></div>
          <ProgressBar value={getSpentPercentage(monthlyBudget.spent, monthlyBudget.limit)} />
          <p>تتحدث تلقائيًا عند استيراد نسخة جديدة من تطبيق راتبي.</p>
        </section>
      )}
      {!monthlyBudget && (
        <section className="wish-budget-link-note"><Icon name="spark" size={18} /><div><strong>ميزانية الأماني تأتي من راتبي</strong><p>أضفها هناك ضمن الميزانيات، ثم حدّث بيانات حساب الشهر في رُشد.</p></div></section>
      )}
      {access === 'none' ? (
        <section className="module-empty-state"><span><Icon name="lock" size={24} /></span><strong>هذه الوحدة خاصة</strong><p>مالك البيت لم يفعّل لك الوصول إلى الأماني المشتركة.</p></section>
      ) : (
        <>
          <div className="goals-list">
            {wishes.length === 0 && <section className="module-empty-state"><span><Icon name="heart" size={24} /></span><strong>ما عندكم أماني مشتركة بعد</strong><p>ابدأ بأول أمنية وشاركها مع العائلة.</p></section>}
            {wishes.map((wish, index) => {
              const value = getSpentPercentage(wish.saved, wish.target)
              return <motion.article className="full-goal-card wish-card" key={wish.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}><span className="goal-emoji"><Icon name="heart" size={25} /></span><div><div className="wish-heading"><h2>{wish.title}</h2><b>{value}%</b></div><p>{formatSar(wish.saved)} من {formatSar(wish.target)} ريال · {wish.owner}</p><ProgressBar value={value}/><small>{wish.deadline}</small></div></motion.article>
            })}
          </div>
          {access === 'edit' && !formOpen && <button type="button" className="primary-button" onClick={() => setFormOpen(true)}><Icon name="plus" size={17} /> إضافة أمنية مشتركة</button>}
          {access === 'view' && <div className="view-only-note">صلاحيتك الحالية: عرض فقط</div>}
          {formOpen && (
            <form className="shared-entry-form" onSubmit={submit}>
              <div className="shared-form-heading"><strong>أمنية جديدة</strong><button type="button" onClick={() => setFormOpen(false)} aria-label="إلغاء">×</button></div>
              <input data-autofocus placeholder="اسم الأمنية" value={title} onChange={(event) => setTitle(event.target.value)} />
              <input inputMode="decimal" placeholder="المبلغ المستهدف" value={target} onChange={(event) => setTarget(event.target.value)} />
              <input placeholder="الموعد أو المدة — اختياري" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
              {error && <div className="inline-form-error" role="alert">{error}</div>}
              <button type="submit" disabled={busy}>{busy ? 'جاري الحفظ…' : 'حفظ الأمنية'}</button>
            </form>
          )}
        </>
      )}
      <section className={`shared-status sync-${syncStatus}`}><span className="live-dot"/><div><strong>{sync.title}</strong><p>{sync.body}</p></div></section>
    </motion.main>
  )
}

function MarketView({
  monthKey,
  setMonthKey,
  budget,
  expenses,
  onSaveBudget,
  onAddExpense,
  canManageBudget,
  access,
  syncStatus,
  syncError,
}: {
  monthKey: string
  setMonthKey: (value: string) => void
  budget: SharedMarketBudget | null
  expenses: SharedMarketExpense[]
  onSaveBudget: (amount: number) => Promise<void>
  onAddExpense: (amount: number, title: string) => Promise<void>
  canManageBudget: boolean
  access: AccessLevel
  syncStatus: SharedSyncStatus
  syncError: string
}) {
  const sync = syncMessage(syncStatus, syncError)
  const spent = expenses.reduce((total, expense) => total + expense.amount, 0)
  const budgetAmount = budget?.amount ?? 0
  const remaining = budgetAmount - spent
  const progress = getSpentPercentage(spent, budgetAmount)
  const [budgetFormOpen, setBudgetFormOpen] = useState(canManageBudget && !budget)
  const [budgetDraft, setBudgetDraft] = useState(budget ? String(budget.amount) : '')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseTitle, setExpenseTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [budgetError, setBudgetError] = useState('')
  const [expenseError, setExpenseError] = useState('')

  useEffect(() => {
    setBudgetDraft(budget ? String(budget.amount) : '')
    setBudgetFormOpen(canManageBudget && !budget)
    setBudgetError('')
    setExpenseError('')
  }, [budget?.amount, canManageBudget, monthKey])

  const submitBudget = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = parseCurrencyInput(budgetDraft)
    if (!Number.isFinite(amount) || amount <= 0) {
      setBudgetError('اكتب ميزانية شهرية صحيحة.')
      return
    }
    setBusy(true)
    setBudgetError('')
    try {
      await onSaveBudget(amount)
      setBudgetFormOpen(false)
    } catch (cause: unknown) {
      setBudgetError(cause instanceof Error ? cause.message : 'تعذر حفظ ميزانية السوبرماركت.')
    } finally {
      setBusy(false)
    }
  }

  const submitExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = parseCurrencyInput(expenseAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setExpenseError('اكتب مبلغ المشتريات بشكل صحيح.')
      return
    }
    setBusy(true)
    setExpenseError('')
    try {
      await onAddExpense(amount, expenseTitle)
      setExpenseAmount('')
      setExpenseTitle('')
    } catch (cause: unknown) {
      setExpenseError(cause instanceof Error ? cause.message : 'تعذر خصم المبلغ من الميزانية.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.main className="screen-content" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
      <section className={`market-budget-hero ${remaining < 0 ? 'is-over' : ''}`}>
        <div className="market-month-row">
          <div><span>ميزانية السوبرماركت</span><small>{formatMonthLabel(monthKey)}</small></div>
          <input type="month" lang="ar" dir="rtl" value={monthKey} onChange={(event) => event.target.value && setMonthKey(event.target.value)} aria-label="شهر ميزانية السوبرماركت" />
        </div>
        {syncStatus === 'connecting' ? (
          <><h1>نراجع ميزانية الشهر…</h1><p>لحظة ونجيب آخر المشتريات المسجلة في البيت.</p></>
        ) : access === 'none' ? (
          <><h1>هذه الميزانية خاصة</h1><p>مالك البيت يقدر يمنحك صلاحية العرض أو التعديل.</p></>
        ) : !budget ? (
          canManageBudget
            ? <><h1>حدّد ميزانية الشهر</h1><p>اختر المبلغ المتاح للسوبرماركت، وبعدها كل مشتريات العائلة تنخصم منه مباشرة.</p></>
            : <><h1>بانتظار ميزانية رب الأسرة</h1><p>أول ما يحددها ستظهر لك هنا تلقائيًا، وبعدها تقدرين تسجلين المشتريات.</p></>
        ) : (
          <>
            <span className="market-balance-label">{remaining >= 0 ? 'المتبقي هذا الشهر' : 'تجاوزتم الميزانية بـ'}</span>
            <strong className="market-balance">{formatMarketSar(Math.abs(remaining))} <small>ريال</small></strong>
            <div className="market-budget-progress" aria-label={`استخدمتم ${progress}% من ميزانية السوبرماركت`}><motion.i initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: .65 }} /></div>
            <div className="market-budget-stats">
              <div><span>ميزانية الشهر</span><b>{formatMarketSar(budgetAmount)} ريال</b></div>
              <div><span>المصروف حتى الآن</span><b>{formatMarketSar(spent)} ريال</b></div>
            </div>
            <small className="market-budget-source">{canManageBudget ? 'أنت المسؤول عن تحديد الميزانية' : 'حددها رب الأسرة وتُحدّث عندك تلقائيًا'}</small>
          </>
        )}
      </section>

      {access !== 'none' && syncStatus !== 'connecting' && (
        <>
          {canManageBudget && budgetFormOpen && (
            <form className="shared-entry-form market-budget-form" onSubmit={submitBudget}>
              <div className="shared-form-heading">
                <div><strong>{budget ? 'تعديل ميزانية الشهر' : 'ميزانية الشهر'}</strong><small>المبلغ المتاح للسوبرماركت فقط</small></div>
                {budget && <button type="button" onClick={() => setBudgetFormOpen(false)} aria-label="إلغاء تعديل الميزانية">×</button>}
              </div>
              <label className="market-form-label"><span>الميزانية بالريال</span><input data-autofocus inputMode="decimal" value={budgetDraft} onChange={(event) => setBudgetDraft(event.target.value)} placeholder="مثلاً 1500" aria-label="ميزانية السوبرماركت الشهرية" /></label>
              {budgetError && <div className="inline-form-error" role="alert">{budgetError}</div>}
              <button type="submit" disabled={busy}>{busy ? 'جاري الحفظ…' : budget ? 'حفظ الميزانية الجديدة' : 'اعتماد ميزانية الشهر'}</button>
            </form>
          )}

          {budget && canManageBudget && !budgetFormOpen && (
            <button type="button" className="secondary-button market-edit-budget" onClick={() => setBudgetFormOpen(true)}>تعديل ميزانية الشهر</button>
          )}

          {budget && access === 'edit' && (
            <form className="section-block market-deduction-form" onSubmit={submitExpense}>
              <div className="section-title"><div><span>خصم سريع</span><h2>سجّل قيمة المشتريات</h2></div><i aria-hidden="true"><Icon name="minus" size={20} /></i></div>
              <label className="market-form-label"><span>المبلغ المدفوع</span><div className="market-amount-input"><input inputMode="decimal" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} placeholder="0" aria-label="قيمة مشتريات السوبرماركت" /><b>ريال</b></div></label>
              <label className="market-form-label"><span>ملاحظة — اختيارية</span><input value={expenseTitle} onChange={(event) => setExpenseTitle(event.target.value)} placeholder="مثلاً بنده أو مشتريات الأسبوع" aria-label="وصف مشتريات السوبرماركت" /></label>
              {expenseError && <div className="inline-form-error" role="alert">{expenseError}</div>}
              <button type="submit" disabled={busy}>{busy ? 'جاري الخصم…' : 'خصم من الميزانية'}</button>
            </form>
          )}

          {budget && (
            <section className="section-block market-ledger">
              <div className="section-title"><div><span>حركة الميزانية</span><h2>آخر المشتريات</h2></div><b>{expenses.length}</b></div>
              {expenses.length === 0 && <div className="module-empty-state compact"><span><Icon name="receipt" size={23} /></span><strong>ما فيه مشتريات مسجلة</strong><p>أول مبلغ تسجلونه سيظهر هنا ويُخصم من الميزانية.</p></div>}
              {expenses.map((expense, index) => (
                <motion.article className="market-expense-row" key={expense.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .06 }}>
                  <span aria-hidden="true"><Icon name="cart" size={19} /></span>
                  <div><strong>{expense.title}</strong><small>{expense.owner} · {expense.dateLabel}</small></div>
                  <b>−{formatMarketSar(expense.amount)}</b>
                </motion.article>
              ))}
            </section>
          )}

          {access === 'view' && <div className="view-only-note">صلاحيتك الحالية: عرض الميزانية فقط</div>}
        </>
      )}
      <section className={`shared-status sync-${syncStatus}`}><span className="live-dot"/><div><strong>{sync.title}</strong><p>{sync.body}</p></div></section>
    </motion.main>
  )
}

export default function App({ user, displayName, onLogout }: AppProps) {
  const [tab, setTab] = useState<Tab>('home')
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey())
  const [marketMonthKey, setMarketMonthKey] = useState(getCurrentMonthKey())
  const [message, setMessage] = useState(tabMessages.home)
  const [counter, setCounter] = useState(0)
  const monthly = useMonthlyPlan(user, monthKey)
  const shared = useSharedModules(user, marketMonthKey)
  const plan = monthly.plan

  const mood = useMemo(() => tab === 'month' || tab === 'market' ? 'thinking' : tab === 'wishes' ? 'happy' : 'calm', [tab])
  const marketDataIsCurrent = shared.marketBudget?.monthKey === marketMonthKey
  const marketExpenses = marketDataIsCurrent ? shared.marketExpenses : []
  const marketBudget = marketDataIsCurrent ? shared.marketBudget : null
  const marketSpent = marketExpenses.reduce((total, expense) => total + expense.amount, 0)
  const marketRemaining = marketBudget ? marketBudget.amount - marketSpent : null
  const safeName = displayName.trim() || user.displayName?.trim() || user.email?.split('@')[0] || 'عضو رُشد'
  const initial = Array.from(safeName)[0] || 'ر'

  const changeTab = (next: Tab) => {
    setTab(next)
    setMessage(tabMessages[next])
  }

  const importFromRatibi = async (bundle: RatibiFinanceBundleV1) => {
    await monthly.importFromRatibi(bundle)
    if (bundle.month !== monthKey) setMonthKey(bundle.month)
    setMessage(`وصلت بيانات ${formatMonthLabel(bundle.month)} من راتبي ورتّبتها لك.`)
  }

  const addWish = async (input: { title: string; icon: string; target: number; deadline: string }) => {
    await shared.addWish(input)
    setMessage('تمت إضافة الأمنية ومزامنتها مع البيت.')
  }

  const saveMarketBudget = async (amount: number) => {
    await shared.saveMarketBudget(amount)
    setMessage(`تم اعتماد ميزانية السوبرماركت: ${formatMarketSar(amount)} ريال.`)
  }

  const addMarketExpense = async (amount: number, title: string) => {
    const projectedRemaining = (marketBudget?.amount ?? 0) - (marketSpent + amount)
    await shared.addMarketExpense(amount, title)
    setMessage(projectedRemaining < 0
      ? `تنبيه: تجاوزتم ميزانية السوبرماركت بـ ${formatMarketSar(Math.abs(projectedRemaining))} ريال.`
      : `تم الخصم. باقي ${formatMarketSar(projectedRemaining)} ريال من ميزانية السوبرماركت.`)
  }

  const pressCharacter = () => {
    if (!plan) {
      setMessage('اربط حساب راتبي مرة واحدة، وبعدها تصل تحديثات الشهر تلقائيًا.')
      return
    }
    const snapshot = getFinancialSnapshot(plan.salary, plan.categories)
    const messages = [
      `باقي معك ${formatSar(snapshot.remaining)} ريال من راتب هذا الشهر.`,
      snapshot.watch ? `عندك ${snapshot.watch} فئات تحتاج متابعة.` : 'كل ميزانياتك حاليًا في النطاق الآمن.',
      'بيانات البيت مشتركة حسب الصلاحيات، وحسابك المالي الخاص لا يشاركه أحد.',
    ]
    const next = counter + 1
    setCounter(next)
    setMessage(messages[next % messages.length])
  }

  if (monthly.status === 'loading') {
    return <main className="system-screen"><span className="live-dot"/><h1>جاري تحميل حسابك…</h1><p>لحظة ونجيب آخر نسخة محفوظة من شهرِك.</p></main>
  }

  if (monthly.status === 'error') {
    return <main className="system-screen" role="alert"><div className="system-mark">!</div><h1>تعذر فتح حساب الشهر.</h1><p>{monthly.error}</p><button type="button" onClick={() => window.location.reload()}>إعادة المحاولة</button><button type="button" className="system-link-button" onClick={() => void onLogout()}>تسجيل الخروج</button></main>
  }

  return (
    <div className="app-canvas" dir="rtl">
      <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
      <div className="phone-app">
        <header className="topbar">
          <div className="profile"><span className="avatar">{initial}</span><div><small>{greeting()}</small><strong>{safeName}</strong></div></div>
          <button type="button" className="header-signout" onClick={() => void onLogout()} aria-label="تسجيل الخروج"><Icon name="logout" size={16} /><span>خروج</span></button>
        </header>
        <div className="character-dock"><RushdCharacter mood={mood} size="sm" message={message} interactive onPress={pressCharacter}/></div>
        {(monthly.error || shared.error) && <div className="app-inline-alert" role="alert">{monthly.error || shared.error}</div>}
        <AnimatePresence mode="wait">
          {tab === 'home' && (
            plan
              ? <HomeView key="home" salary={plan.salary} categories={plan.categories} wishes={shared.wishes} marketRemaining={marketRemaining} onOpenMonth={() => changeTab('month')}/>
              : <EmptyHomeView key="home-empty" onOpenMonth={() => changeTab('month')} />
          )}
          {tab === 'month' && (
            <MonthView key="month" plan={plan} onImport={importFromRatibi} saving={monthly.saving} ratibiSync={monthly.ratibiSync}/>
          )}
          {tab === 'wishes' && (
            <WishesView key="wishes" wishes={shared.wishes} monthlyBudget={getRatibiWishesBudget(plan?.ratibi ?? null)} onAdd={addWish} access={shared.permissions.wishes} syncStatus={shared.status} syncError={shared.error}/>
          )}
          {tab === 'market' && (
            <MarketView
              key="market"
              monthKey={marketMonthKey}
              setMonthKey={setMarketMonthKey}
              budget={marketBudget}
              expenses={marketExpenses}
              onSaveBudget={saveMarketBudget}
              onAddExpense={addMarketExpense}
              canManageBudget={shared.isHouseholdOwner}
              access={shared.permissions.market}
              syncStatus={shared.status}
              syncError={shared.error}
            />
          )}
        </AnimatePresence>
        <nav className="bottom-nav" aria-label="التنقل الرئيسي">
          <button type="button" className={tab === 'home' ? 'active' : ''} onClick={() => changeTab('home')} aria-current={tab === 'home' ? 'page' : undefined}><span><Icon name="home" size={21} /></span><small>الرئيسية</small></button>
          <button type="button" className={tab === 'month' ? 'active' : ''} onClick={() => changeTab('month')} aria-current={tab === 'month' ? 'page' : undefined}><span><Icon name="month" size={21} /></span><small>حساب الشهر</small></button>
          <button type="button" className={tab === 'wishes' ? 'active' : ''} onClick={() => changeTab('wishes')} aria-current={tab === 'wishes' ? 'page' : undefined}><span><Icon name="heart" size={21} /></span><small>الأماني</small></button>
          <button type="button" className={tab === 'market' ? 'active' : ''} onClick={() => changeTab('market')} aria-current={tab === 'market' ? 'page' : undefined}><span><Icon name="cart" size={21} /></span><small>السوبرماركت</small></button>
        </nav>
      </div>
    </div>
  )
}
