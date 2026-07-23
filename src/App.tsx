import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { User } from 'firebase/auth'
import { RushdCharacter } from './components/RushdCharacter'
import { useSharedModules, type SharedSyncStatus } from './hooks/useSharedModules'
import { useMonthlyPlan } from './hooks/useMonthlyPlan'
import { formatSar, getSpentPercentage } from './lib/finance'
import {
  buildSuggestedBudget,
  getFinancialSignals,
  getFinancialSnapshot,
  type BudgetCategory,
} from './lib/financialEngine'
import {
  formatMonthLabel,
  formatTransactionDate,
  getCurrentMonthKey,
  getNextMonthKey,
  type MonthlyTransaction,
} from './lib/monthlyPlanRepository'
import type { AccessLevel } from './lib/household'
import type { SharedMarketItem, SharedWish } from './lib/householdRepository'

type Tab = 'home' | 'month' | 'wishes' | 'market'

type AppProps = {
  user: User
  displayName: string
  onSaveDisplayName: (name: string) => Promise<void>
  onLogout: () => Promise<void>
}

const tabMessages: Record<Tab, string> = {
  home: 'هذه قراءة شهرِك الحالي، وكل رقم هنا محفوظ في حسابك الخاص.',
  month: 'غيّر الراتب أو أضف مصروفًا، وأنا أعيد قراءة الخطة فورًا.',
  wishes: 'كل أمنية مشتركة هنا مرتبطة بالبيت، مو بحسابك المالي الخاص.',
  market: 'القائمة مشتركة، لذلك ما عاد فيه: كنت أحسبك اشتريتها.',
}

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
  pendingMarket,
  onOpenMonth,
}: {
  salary: number
  categories: BudgetCategory[]
  wishes: SharedWish[]
  pendingMarket: number
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
        <button type="button" className="hero-action" onClick={onOpenMonth}>فتح حساب الشهر ←</button>
      </section>

      <section className="financial-metrics">
        <article><span>المصروف</span><strong>{formatSar(snapshot.spent)}</strong><small>من {formatSar(salary)} ريال</small></article>
        <article><span>للمستقبل</span><strong>{snapshot.futureRate}%</strong><small>استثمار وأمان</small></article>
        <article className={snapshot.watch ? 'metric-watch' : ''}><span>تحتاج متابعة</span><strong>{snapshot.watch}</strong><small>فئات هذا الشهر</small></article>
      </section>

      <section className="section-block intelligence-card">
        <div className="section-title"><div><span>قراءة رُشد</span><h2>ما الذي يحتاج قرارك؟</h2></div><i className="thinking-dot">✦</i></div>
        <div className="signal-list">
          {signals.map((signal, index) => (
            <motion.article className={`signal-row signal-${signal.level}`} key={signal.title} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }}>
              <span>{signal.level === 'danger' ? '!' : signal.level === 'watch' ? '◷' : '✓'}</span>
              <div><strong>{signal.title}</strong><p>{signal.body}</p></div>
            </motion.article>
          ))}
        </div>
      </section>

      {nearestWish ? (
        <section className="section-block">
          <div className="section-title"><div><span>الأقرب الآن</span><h2>{nearestWish.title}</h2></div><b>{wishProgress}%</b></div>
          <div className="goal-focus-row"><span className="goal-art">{nearestWish.icon}</span><div><strong>{formatSar(nearestWish.saved)} من {formatSar(nearestWish.target)} ريال</strong><ProgressBar value={wishProgress}/><small>{nearestWish.deadline}</small></div></div>
        </section>
      ) : (
        <section className="section-block empty-module-card"><span>♡</span><div><strong>لا توجد أمنية مشتركة</strong><p>أضف أول أمنية من صفحة أماني رُشد.</p></div></section>
      )}

      <section className="living-summary">
        <motion.span animate={{ rotate: [0, 18, 0], scale: [1, 1.2, 1] }} transition={{ duration: 2.8, repeat: Infinity }}>✦</motion.span>
        <div><strong>ملخص البيت</strong><p>{pendingMarket} عناصر في السوبرماركت، وخطتك المالية الخاصة لا تظهر لأي عضو.</p></div>
      </section>
    </motion.main>
  )
}

const buildWeeklyBars = (transactions: MonthlyTransaction[]) => {
  const weeks = [0, 0, 0, 0, 0, 0]
  const now = Date.now()
  transactions.forEach((transaction) => {
    const ageInWeeks = Math.floor(Math.max(0, now - transaction.occurredAt.getTime()) / (7 * 24 * 60 * 60 * 1000))
    const index = 5 - ageInWeeks
    if (index >= 0 && index < weeks.length) weeks[index] += transaction.amount
  })
  const max = Math.max(...weeks, 1)
  return weeks.map((amount) => amount <= 0 ? 0 : Math.max(8, Math.round((amount / max) * 100)))
}

function MonthView({
  monthKey,
  setMonthKey,
  salary,
  salaryDraft,
  setSalaryDraft,
  categories,
  transactions,
  onRebuild,
  onAddExpense,
  saving,
  fromCache,
  hasPendingWrites,
}: {
  monthKey: string
  setMonthKey: (value: string) => void
  salary: number
  salaryDraft: string
  setSalaryDraft: (value: string) => void
  categories: BudgetCategory[]
  transactions: MonthlyTransaction[]
  onRebuild: (event: FormEvent<HTMLFormElement>) => void
  onAddExpense: (title: string, amount: number, categoryId: string) => Promise<void>
  saving: boolean
  fromCache: boolean
  hasPendingWrites: boolean
}) {
  const snapshot = getFinancialSnapshot(salary, categories)
  const [expenseTitle, setExpenseTitle] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState(categories[0]?.id ?? 'needs')
  const [formError, setFormError] = useState('')
  const weeklyBars = useMemo(() => buildWeeklyBars(transactions), [transactions])

  useEffect(() => {
    if (!categories.some((category) => category.id === expenseCategory)) {
      setExpenseCategory(categories[0]?.id ?? 'needs')
    }
  }, [categories, expenseCategory])

  const submitExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = Number(expenseAmount)
    if (!expenseTitle.trim() || !Number.isFinite(amount) || amount <= 0) {
      setFormError('اكتب اسم المصروف ومبلغًا صحيحًا.')
      return
    }
    setFormError('')
    try {
      await onAddExpense(expenseTitle.trim(), amount, expenseCategory)
      setExpenseTitle('')
      setExpenseAmount('')
    } catch (cause: unknown) {
      setFormError(cause instanceof Error ? cause.message : 'تعذر تسجيل المصروف.')
    }
  }

  const syncLabel = hasPendingWrites ? 'جاري الحفظ…' : fromCache ? 'نسخة محفوظة على الجهاز' : 'محفوظ في حسابك'

  return (
    <motion.main className="screen-content" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
      <section className="month-switcher" aria-label="اختيار الشهر">
        <div><span>الشهر المفتوح</span><strong>{formatMonthLabel(monthKey)}</strong><small>{syncLabel}</small></div>
        <input type="month" value={monthKey} onChange={(event) => setMonthKey(event.target.value)} aria-label="اختيار شهر الخطة" />
        <button type="button" onClick={() => setMonthKey(getNextMonthKey(monthKey))}>شهر جديد</button>
      </section>

      <section className="month-command-card">
        <span>حساب الشهر</span><h1>راتبك يدخل مرة، والخطة تتغير فورًا.</h1>
        <form className="salary-form" onSubmit={onRebuild}>
          <label><small>الراتب الشهري</small><div><input inputMode="decimal" value={salaryDraft} onChange={(event) => setSalaryDraft(event.target.value)} aria-label="الراتب الشهري"/><b>ريال</b></div></label>
          <button type="submit" disabled={saving}>{saving ? 'جاري الحفظ…' : 'بناء الخطة'}</button>
        </form>
        <div className="month-kpis"><div><b>{formatSar(snapshot.spent)}</b><span>المصروف</span></div><div><b>{formatSar(snapshot.remaining)}</b><span>المتبقي</span></div><div><b>{snapshot.score}%</b><span>الصحة المالية</span></div></div>
      </section>

      <section className="section-block">
        <div className="section-title"><div><span>توزيع ذكي</span><h2>ميزانيات الشهر</h2></div><span className={`plan-status ${snapshot.overspent ? 'danger' : ''}`}>{snapshot.overspent ? 'يحتاج تدخل' : 'متوازن'}</span></div>
        <div className="budget-category-list">
          {categories.map((category, index) => {
            const usage = getSpentPercentage(category.spent, category.limit)
            const status = category.spent > category.limit ? 'danger' : usage >= 80 ? 'watch' : 'good'
            return (
              <motion.article className={`budget-category ${status}`} key={category.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07 }}>
                <span className={`category-icon ${category.tone}`}>{category.icon}</span>
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

      <section className="section-block expense-entry-card">
        <div className="section-title"><div><span>تسجيل سريع</span><h2>أضف مصروفًا</h2></div></div>
        <form className="expense-form" onSubmit={submitExpense}>
          <input placeholder="اسم المصروف" value={expenseTitle} onChange={(event) => setExpenseTitle(event.target.value)} aria-label="اسم المصروف"/>
          <div className="expense-form-row">
            <input inputMode="decimal" placeholder="المبلغ" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} aria-label="مبلغ المصروف"/>
            <select value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)} aria-label="فئة المصروف">
              {categories.map((category) => <option value={category.id} key={category.id}>{category.title}</option>)}
            </select>
          </div>
          {formError && <div className="inline-form-error" role="alert">{formError}</div>}
          <button type="submit" disabled={saving}>＋ {saving ? 'جاري الحفظ…' : 'تسجيل المصروف'}</button>
        </form>
      </section>

      <section className="section-block analytics-card">
        <div className="section-title"><div><span>اتجاه الصرف</span><h2>آخر 6 أسابيع</h2></div><b>{snapshot.utilization}%</b></div>
        <div className="weekly-chart" aria-label="رسم اتجاه الصرف">
          {weeklyBars.map((value, index) => <motion.i key={index} initial={{ height: 0 }} animate={{ height: `${value}%` }} transition={{ delay: index * 0.08 }}><small>{index + 1}</small></motion.i>)}
        </div>
      </section>

      <section className="section-block transaction-section">
        <div className="section-title"><div><span>آخر الحركات</span><h2>سجل المصروفات</h2></div><b>{transactions.length}</b></div>
        {transactions.length === 0 && <div className="transaction-empty">ما سجلت أي مصروف في هذا الشهر.</div>}
        {transactions.slice(0, 12).map((transaction) => {
          const category = categories.find((item) => item.id === transaction.categoryId)
          return <article className="transaction-row" key={transaction.id}><span className="transaction-icon">{category?.icon ?? '•'}</span><div><strong>{transaction.title}</strong><small>{category?.title} · {formatTransactionDate(transaction.occurredAt)}</small></div><b>-{formatSar(transaction.amount)}</b></article>
        })}
      </section>
    </motion.main>
  )
}

function WishesView({
  wishes,
  onAdd,
  access,
  syncStatus,
  syncError,
}: {
  wishes: SharedWish[]
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
      {access === 'none' ? (
        <section className="module-empty-state"><span>🔒</span><strong>هذه الوحدة خاصة</strong><p>مالك البيت لم يفعّل لك الوصول إلى الأماني المشتركة.</p></section>
      ) : (
        <>
          <div className="goals-list">
            {wishes.length === 0 && <section className="module-empty-state"><span>♡</span><strong>ما عندكم أماني مشتركة بعد</strong><p>ابدأ بأول أمنية وشاركها مع العائلة.</p></section>}
            {wishes.map((wish, index) => {
              const value = getSpentPercentage(wish.saved, wish.target)
              return <motion.article className="full-goal-card wish-card" key={wish.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}><span className="goal-emoji">{wish.icon}</span><div><div className="wish-heading"><h2>{wish.title}</h2><b>{value}%</b></div><p>{formatSar(wish.saved)} من {formatSar(wish.target)} ريال · {wish.owner}</p><ProgressBar value={value}/><small>{wish.deadline}</small></div></motion.article>
            })}
          </div>
          {access === 'edit' && !formOpen && <button type="button" className="primary-button" onClick={() => setFormOpen(true)}>＋ إضافة أمنية مشتركة</button>}
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
  items,
  onToggle,
  onAdd,
  access,
  syncStatus,
  syncError,
}: {
  items: SharedMarketItem[]
  onToggle: (item: SharedMarketItem) => Promise<void>
  onAdd: (title: string, quantity: string) => Promise<void>
  access: AccessLevel
  syncStatus: SharedSyncStatus
  syncError: string
}) {
  const checked = items.filter((item) => item.checked).length
  const progress = getSpentPercentage(checked, items.length)
  const sync = syncMessage(syncStatus, syncError)
  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [quantity, setQuantity] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim()) {
      setError('اكتب اسم العنصر أولًا.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onAdd(title.trim(), quantity.trim() || 'بدون كمية')
      setTitle('')
      setQuantity('')
      setFormOpen(false)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'تعذرت إضافة العنصر.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.main className="screen-content" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
      <section className="market-hero"><span>السوبرماركت المشترك</span><h1>{access === 'none' ? 'قائمة خاصة' : `${items.length - checked} عناصر متبقية`}</h1><p>كل عضو يرى التحديث حسب مستوى صلاحيته: عرض فقط أو عرض وتعديل.</p><ProgressBar value={progress}/></section>
      <section className="section-block market-list">
        {access === 'none' ? (
          <div className="module-empty-state compact"><span>🔒</span><strong>لا تملك وصولًا لهذه القائمة</strong><p>يقدر مالك البيت تفعيلها لك من الصلاحيات.</p></div>
        ) : (
          <>
            {items.length === 0 && <div className="module-empty-state compact"><span>🛒</span><strong>القائمة فاضية</strong><p>أضف أول احتياج للبيت.</p></div>}
            {items.map((item, index) => <motion.button type="button" disabled={access !== 'edit' || busy} className={`market-row ${item.checked ? 'is-checked' : ''}`} key={item.id} onClick={() => void onToggle(item)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07 }}><span className="check-circle">{item.checked ? '✓' : ''}</span><span className="market-copy"><strong>{item.title}</strong><small>{item.quantity} · أضافها {item.owner}</small></span></motion.button>)}
            {access === 'edit' && !formOpen && <button type="button" className="secondary-button" onClick={() => setFormOpen(true)}>＋ إضافة عنصر</button>}
            {access === 'view' && <div className="view-only-note">صلاحيتك الحالية: عرض فقط</div>}
            {formOpen && (
              <form className="shared-entry-form compact" onSubmit={submit}>
                <div className="shared-form-heading"><strong>عنصر جديد</strong><button type="button" onClick={() => setFormOpen(false)} aria-label="إلغاء">×</button></div>
                <input data-autofocus placeholder="اسم العنصر" value={title} onChange={(event) => setTitle(event.target.value)} />
                <input placeholder="الكمية — اختياري" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                {error && <div className="inline-form-error" role="alert">{error}</div>}
                <button type="submit" disabled={busy}>{busy ? 'جاري الحفظ…' : 'إضافة للقائمة'}</button>
              </form>
            )}
          </>
        )}
      </section>
      <section className={`shared-status sync-${syncStatus}`}><span className="live-dot"/><div><strong>{sync.title}</strong><p>{sync.body}</p></div></section>
    </motion.main>
  )
}

function MonthSetup({
  monthKey,
  setMonthKey,
  displayName,
  suggestedSalary,
  busy,
  error,
  onSubmit,
  onLogout,
}: {
  monthKey: string
  setMonthKey: (value: string) => void
  displayName: string
  suggestedSalary: string
  busy: boolean
  error: string
  onSubmit: (name: string, salary: number) => Promise<void>
  onLogout: () => Promise<void>
}) {
  const [name, setName] = useState(displayName)
  const [salary, setSalary] = useState(suggestedSalary)
  const [localError, setLocalError] = useState('')

  useEffect(() => setName(displayName), [displayName])
  useEffect(() => { if (suggestedSalary) setSalary(suggestedSalary) }, [suggestedSalary])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = Number(salary)
    if (name.trim().length < 2 || !Number.isFinite(value) || value <= 0) {
      setLocalError('اكتب اسمك وراتبًا شهريًا صحيحًا.')
      return
    }
    setLocalError('')
    try {
      await onSubmit(name.trim(), value)
    } catch (cause: unknown) {
      setLocalError(cause instanceof Error ? cause.message : 'تعذر إنشاء خطة الشهر.')
    }
  }

  return (
    <div className="app-canvas setup-canvas">
      <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
      <main className="month-setup-card">
        <div className="setup-topline"><span className="auth-logo">ر</span><button type="button" onClick={() => void onLogout()}>تسجيل الخروج</button></div>
        <RushdCharacter mood="happy" size="md" message="أول خطوة بسيطة: اسمك، راتبك، وبعدها أبني لك شهرًا نظيفًا بدون بيانات جاهزة." />
        <span className="setup-eyebrow">تهيئة حساب الشهر</span>
        <h1>خلّنا نبني {formatMonthLabel(monthKey)}.</h1>
        <p>لن نضيف أي مصروفات افتراضية. تبدأ خطتك صفر، وكل حركة تسجلها تكون لك وحدك.</p>
        <form onSubmit={submit}>
          <label><span>اسمك</span><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label><span>الشهر</span><input type="month" value={monthKey} onChange={(event) => setMonthKey(event.target.value)} /></label>
          <label><span>الراتب الشهري</span><div><input inputMode="decimal" value={salary} onChange={(event) => setSalary(event.target.value)} placeholder="مثلاً 12000"/><b>ريال</b></div></label>
          {(localError || error) && <div className="auth-error" role="alert">{localError || error}</div>}
          <button type="submit" disabled={busy}>{busy ? 'جاري بناء الخطة…' : 'ابدأ حساب الشهر'}</button>
        </form>
        <small className="setup-privacy">الراتب والمصروفات والاستثمارات خاصة بحسابك ولا يقرأها أعضاء العائلة.</small>
      </main>
    </div>
  )
}

export default function App({ user, displayName, onSaveDisplayName, onLogout }: AppProps) {
  const [tab, setTab] = useState<Tab>('home')
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey())
  const [salaryDraft, setSalaryDraft] = useState('')
  const [lastKnownSalary, setLastKnownSalary] = useState('')
  const [message, setMessage] = useState(tabMessages.home)
  const [counter, setCounter] = useState(0)
  const monthly = useMonthlyPlan(user, monthKey)
  const shared = useSharedModules(user)
  const plan = monthly.plan

  useEffect(() => {
    if (!plan) return
    const value = String(plan.salary)
    setSalaryDraft(value)
    setLastKnownSalary(value)
  }, [plan?.monthKey, plan?.salary])

  const mood = useMemo(() => tab === 'month' || tab === 'market' ? 'thinking' : tab === 'wishes' ? 'happy' : 'calm', [tab])
  const pendingMarket = shared.marketItems.filter((item) => !item.checked).length
  const safeName = displayName.trim() || user.displayName?.trim() || user.email?.split('@')[0] || 'عضو رُشد'
  const initial = Array.from(safeName)[0] || 'ر'

  const changeTab = (next: Tab) => {
    setTab(next)
    setMessage(tabMessages[next])
  }

  const createPlan = async (name: string, salary: number) => {
    await onSaveDisplayName(name)
    await monthly.savePlan(salary, buildSuggestedBudget(salary))
    setMessage('تم بناء الشهر وحفظه في حسابك الخاص.')
  }

  const rebuildPlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextSalary = Number(salaryDraft)
    if (!plan || !Number.isFinite(nextSalary) || nextSalary <= 0) {
      setMessage('اكتب راتبًا صحيحًا أولًا، وبعدها أبني لك الخطة.')
      return
    }
    const nextCategories = buildSuggestedBudget(nextSalary, plan.categories)
    void monthly.savePlan(nextSalary, nextCategories)
      .then(() => setMessage('أعدت توزيع الراتب مع الحفاظ على مصروفاتك الحالية.'))
      .catch((cause: unknown) => setMessage(cause instanceof Error ? cause.message : 'تعذر حفظ الخطة.'))
  }

  const addExpense = async (title: string, amount: number, categoryId: string) => {
    if (!plan) throw new Error('ابدأ خطة الشهر أولًا.')
    const category = plan.categories.find((item) => item.id === categoryId)
    const projected = (category?.spent ?? 0) + amount
    await monthly.addExpense(title, amount, categoryId)
    setMessage(projected > (category?.limit ?? Number.POSITIVE_INFINITY) ? `انتبه: ${category?.title} تجاوزت الميزانية بعد هذا المصروف.` : 'تم تسجيل المصروف وحفظه في حسابك.')
  }

  const addWish = async (input: { title: string; icon: string; target: number; deadline: string }) => {
    await shared.addWish(input)
    setMessage('تمت إضافة الأمنية ومزامنتها مع البيت.')
  }

  const addMarketItem = async (title: string, quantity: string) => {
    await shared.addMarket(title, quantity)
    setMessage('تمت إضافة العنصر ومزامنته مع البيت.')
  }

  const toggleMarketItem = async (item: SharedMarketItem) => {
    await shared.toggleMarket(item)
    setMessage('تم تحديث حالة العنصر.')
  }

  const pressCharacter = () => {
    if (!plan) return
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

  if (!plan) {
    return <MonthSetup monthKey={monthKey} setMonthKey={setMonthKey} displayName={safeName} suggestedSalary={lastKnownSalary} busy={monthly.saving} error={monthly.error} onSubmit={createPlan} onLogout={onLogout} />
  }

  return (
    <div className="app-canvas">
      <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
      <div className="phone-app">
        <header className="topbar">
          <div className="profile"><span className="avatar">{initial}</span><div><small>{greeting()}</small><strong>{safeName}</strong></div></div>
          <button type="button" className="header-signout" onClick={() => void onLogout()} aria-label="تسجيل الخروج">خروج</button>
        </header>
        <div className="character-dock"><RushdCharacter mood={mood} size="sm" message={message} interactive onPress={pressCharacter}/></div>
        {(monthly.error || shared.error) && <div className="app-inline-alert" role="alert">{monthly.error || shared.error}</div>}
        <AnimatePresence mode="wait">
          {tab === 'home' && (
            <HomeView key="home" salary={plan.salary} categories={plan.categories} wishes={shared.wishes} pendingMarket={pendingMarket} onOpenMonth={() => changeTab('month')}/>
          )}
          {tab === 'month' && (
            <MonthView key="month" monthKey={monthKey} setMonthKey={setMonthKey} salary={plan.salary} salaryDraft={salaryDraft} setSalaryDraft={setSalaryDraft} categories={plan.categories} transactions={plan.transactions} onRebuild={rebuildPlan} onAddExpense={addExpense} saving={monthly.saving} fromCache={plan.fromCache} hasPendingWrites={plan.hasPendingWrites}/>
          )}
          {tab === 'wishes' && (
            <WishesView key="wishes" wishes={shared.wishes} onAdd={addWish} access={shared.permissions.wishes} syncStatus={shared.status} syncError={shared.error}/>
          )}
          {tab === 'market' && (
            <MarketView key="market" items={shared.marketItems} onToggle={toggleMarketItem} onAdd={addMarketItem} access={shared.permissions.market} syncStatus={shared.status} syncError={shared.error}/>
          )}
        </AnimatePresence>
        <nav className="bottom-nav" aria-label="التنقل الرئيسي">
          <button type="button" className={tab === 'home' ? 'active' : ''} onClick={() => changeTab('home')} aria-current={tab === 'home' ? 'page' : undefined}><span>⌂</span><small>الرئيسية</small></button>
          <button type="button" className={tab === 'month' ? 'active' : ''} onClick={() => changeTab('month')} aria-current={tab === 'month' ? 'page' : undefined}><span>◫</span><small>حساب الشهر</small></button>
          <button type="button" className={tab === 'wishes' ? 'active' : ''} onClick={() => changeTab('wishes')} aria-current={tab === 'wishes' ? 'page' : undefined}><span>♡</span><small>الأماني</small></button>
          <button type="button" className={tab === 'market' ? 'active' : ''} onClick={() => changeTab('market')} aria-current={tab === 'market' ? 'page' : undefined}><span>🛒</span><small>السوبرماركت</small></button>
        </nav>
      </div>
    </div>
  )
}
