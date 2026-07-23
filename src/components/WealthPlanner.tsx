import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { User } from 'firebase/auth'
import { RushdCharacter } from './RushdCharacter'
import { formatSar, getSpentPercentage } from '../lib/finance'
import {
  buildProjectionPoints,
  buildWealthSnapshot,
  getWealthInsight,
  projectGoal,
  type FinancialGoal,
  type InvestmentAccount,
} from '../lib/wealthEngine'
import {
  addGoalContribution,
  createFinancialGoal,
  createInvestmentAccount,
  loadWealthData,
} from '../lib/wealthRepository'
import { getFirebaseErrorMessage } from '../lib/firebaseErrors'
import { useDialog } from '../hooks/useDialog'

export function WealthPlanner({ onClose, user }: { onClose: () => void; user: User }) {
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([])
  const [goals, setGoals] = useState<FinancialGoal[]>([])
  const [tab, setTab] = useState<'overview' | 'accounts' | 'goals'>('overview')
  const [goalFormOpen, setGoalFormOpen] = useState(false)
  const [accountFormOpen, setAccountFormOpen] = useState(false)
  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalMonthly, setGoalMonthly] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountBalance, setAccountBalance] = useState('')
  const [accountMonthly, setAccountMonthly] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cloudReady, setCloudReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const dialogRef = useDialog<HTMLDivElement>(onClose, !goalFormOpen && !accountFormOpen)

  const snapshot = useMemo(() => buildWealthSnapshot(accounts, goals), [accounts, goals])
  const projections = useMemo(() => buildProjectionPoints(accounts), [accounts])
  const maxProjection = Math.max(...projections.map((point) => point.value), 1)
  const insight = getWealthInsight(snapshot)

  useEffect(() => {
    let active = true
    setLoading(true)
    void loadWealthData(user.uid)
      .then((data) => {
        if (!active) return
        setAccounts(data.accounts)
        setGoals(data.goals)
        setCloudReady(true)
      })
      .catch((cause: unknown) => {
        if (active) setError(getFirebaseErrorMessage(cause, 'تعذر تحميل بيانات الثروة.'))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user.uid])

  const addAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const balance = Number(accountBalance)
    const monthlyContribution = Number(accountMonthly)
    if (!accountName.trim() || !Number.isFinite(balance) || balance < 0 || !Number.isFinite(monthlyContribution) || monthlyContribution < 0) {
      setError('اكتب اسم المحفظة وأرقامًا صحيحة غير سالبة.')
      return
    }
    const input = { name: accountName.trim(), type: 'investment' as const, balance, monthlyContribution, annualReturn: 7, icon: '↗' }
    setBusy(true)
    setError('')
    try {
      const saved = await createInvestmentAccount(user.uid, input)
      setAccounts((current) => [...current, saved])
      setCloudReady(true)
      setAccountFormOpen(false)
      setAccountName('')
      setAccountBalance('')
      setAccountMonthly('')
    } catch (cause: unknown) {
      setError(getFirebaseErrorMessage(cause, 'تعذر إضافة الحساب.'))
    } finally {
      setBusy(false)
    }
  }

  const addGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const target = Number(goalTarget)
    const monthlyContribution = Number(goalMonthly)
    if (!goalName.trim() || !Number.isFinite(target) || target <= 0 || !Number.isFinite(monthlyContribution) || monthlyContribution < 0) {
      setError('اكتب اسم الهدف ومبلغًا مستهدفًا صحيحًا.')
      return
    }
    const input = { name: goalName.trim(), target, saved: 0, monthlyContribution, priority: 'medium' as const, linkedWish: goalName.trim(), icon: '◎' }
    setBusy(true)
    setError('')
    try {
      const saved = await createFinancialGoal(user.uid, input)
      setGoals((current) => [...current, saved])
      setCloudReady(true)
      setGoalFormOpen(false)
      setGoalName('')
      setGoalTarget('')
      setGoalMonthly('')
    } catch (cause: unknown) {
      setError(getFirebaseErrorMessage(cause, 'تعذر إضافة الهدف.'))
    } finally {
      setBusy(false)
    }
  }

  const contribute = async (goal: FinancialGoal, amount: number) => {
    const contribution = Math.min(amount, Math.max(0, goal.target - goal.saved))
    if (contribution <= 0) return
    setBusy(true)
    setError('')
    try {
      await addGoalContribution(user.uid, goal, contribution)
      setGoals((current) => current.map((item) => item.id === goal.id ? { ...item, saved: item.saved + contribution } : item))
    } catch (cause: unknown) {
      setError(getFirebaseErrorMessage(cause, 'تعذر تسجيل المساهمة.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.section className="wealth-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <motion.div ref={dialogRef} className="wealth-sheet" role="dialog" aria-modal="true" aria-labelledby="wealth-title" tabIndex={-1} initial={{ y: 70, scale: .98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 70, scale: .98 }}>
        <button type="button" className="module-close-sticky" onClick={onClose} aria-label="إغلاق الثروة والأهداف">×</button>
        <header className="wealth-header">
          <div><span>الاستثمارات والأهداف</span><h1 id="wealth-title">خلّ فلوسك تعرف وين رايحة.</h1><p>كل مساهمة شهرية مرتبطة بهدف وموعد واضح، مو مجرد رقم في محفظة.</p></div>
          <div className="wealth-character"><RushdCharacter mood="happy" size="sm" message={insight}/></div>
        </header>

        {error && <div className="wealth-message" role="alert">{error}</div>}
        {loading && <div className="wealth-loading"><span className="live-dot"/> جاري تحميل بياناتك الخاصة…</div>}

        <nav className="wealth-tabs">
          <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>النظرة العامة</button>
          <button className={tab === 'accounts' ? 'active' : ''} onClick={() => setTab('accounts')}>المحافظ</button>
          <button className={tab === 'goals' ? 'active' : ''} onClick={() => setTab('goals')}>الأهداف</button>
        </nav>

        <AnimatePresence mode="wait">
          {tab === 'overview' && (
            <motion.main key="overview" className="wealth-content" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              {!loading && accounts.length === 0 && goals.length === 0 && (
                <section className="wealth-empty-launch"><span>◎</span><h2>ابدأ من الصفر، على نظافة.</h2><p>أضف أول محفظة أو هدف مالي. ما فيه أي أرقام تجريبية مختلطة بحسابك.</p><div><button type="button" onClick={() => setTab('accounts')}>إضافة محفظة</button><button type="button" onClick={() => setTab('goals')}>إضافة هدف</button></div></section>
              )}
              <section className="wealth-hero-card">
                <div><span>إجمالي ما بنيته</span><strong>{formatSar(snapshot.totalBalance)} <small>ريال</small></strong><p>تضيف {formatSar(snapshot.totalMonthlyContribution)} ريال شهريًا بشكل منتظم.</p></div>
                <div className="wealth-ring"><b>{snapshot.goalsProgress}%</b><small>تقدم الأهداف</small></div>
              </section>

              <section className="wealth-metrics">
                <article><span>بعد سنة</span><strong>{formatSar(snapshot.projectedInOneYear)}</strong><small>مع استمرار المساهمات</small></article>
                <article><span>بعد 5 سنوات</span><strong>{formatSar(snapshot.projectedInFiveYears)}</strong><small>نمو متوقع {formatSar(snapshot.investmentGrowthFiveYears)}</small></article>
              </section>

              <section className="wealth-card projection-card">
                <div className="wealth-section-title"><div><span>النمو المتوقع</span><h2>خمس سنوات قدّام</h2></div><small>تقديري وليس ضمانًا</small></div>
                <div className="projection-chart">
                  {projections.map((point, index) => <motion.i key={point.months} initial={{ height: 0 }} animate={{ height: `${Math.max(8, point.value / maxProjection * 100)}%` }} transition={{ delay: index * .08 }}><b>{formatSar(point.value)}</b><small>{point.months === 0 ? 'الآن' : `${point.months / 12}س`}</small></motion.i>)}
                </div>
              </section>

              {snapshot.closestGoal && (
                <section className="closest-goal-card">
                  <span>{snapshot.closestGoal.icon}</span><div><small>أقرب هدف</small><h2>{snapshot.closestGoal.name}</h2><p>الوصول المتوقع: {snapshot.closestGoal.projectedDate}</p></div><b>{snapshot.closestGoal.progress}%</b>
                </section>
              )}
            </motion.main>
          )}

          {tab === 'accounts' && (
            <motion.main key="accounts" className="wealth-content" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <section className="wealth-card">
                <div className="wealth-section-title"><div><span>محافظك الخاصة</span><h2>{accounts.length} حسابات</h2></div><small>{cloudReady ? 'محفوظة سحابيًا' : 'جاري التحميل'}</small></div>
                <div className="investment-list">
                  {accounts.length === 0 && <div className="wealth-list-empty">ما عندك محافظ بعد.</div>}
                  {accounts.map((account) => (
                    <article key={account.id}><span>{account.icon}</span><div><strong>{account.name}</strong><small>مساهمة {formatSar(account.monthlyContribution)} · عائد تقديري {account.annualReturn}%</small></div><b>{formatSar(account.balance)}</b></article>
                  ))}
                </div>
                <button className="wealth-primary-button" onClick={() => { setError(''); setAccountFormOpen(true) }}>＋ إضافة محفظة</button>
              </section>
            </motion.main>
          )}

          {tab === 'goals' && (
            <motion.main key="goals" className="wealth-content" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <section className="wealth-card">
                <div className="wealth-section-title"><div><span>أهداف مرتبطة بخطتك</span><h2>{goals.length} أهداف</h2></div><small>{formatSar(snapshot.goalsSaved)} من {formatSar(snapshot.goalsTarget)}</small></div>
                <div className="financial-goals-list">
                  {goals.length === 0 && <div className="wealth-list-empty">ما عندك أهداف مالية بعد.</div>}
                  {goals.map((goal) => {
                    const projection = projectGoal(goal)
                    return <article key={goal.id}><span className="goal-plan-icon">{goal.icon}</span><div className="goal-plan-copy"><div><strong>{goal.name}</strong><b>{projection.progress}%</b></div><p>{formatSar(goal.saved)} من {formatSar(goal.target)} · {projection.projectedDate}</p><div className="wealth-progress"><i style={{ width: `${projection.progress}%` }}/></div>{goal.linkedWish && <small>مرتبط بأمنية: {goal.linkedWish}</small>}</div><button disabled={busy || projection.status === 'complete'} onClick={() => void contribute(goal, 250)}>+250</button></article>
                  })}
                </div>
                <button className="wealth-primary-button" onClick={() => { setError(''); setGoalFormOpen(true) }}>＋ إضافة هدف مالي</button>
              </section>
            </motion.main>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {accountFormOpen && <FormDialog title="إضافة محفظة" onClose={() => setAccountFormOpen(false)} onSubmit={addAccount} busy={busy} error={error}><input placeholder="اسم المحفظة" value={accountName} onChange={(event) => setAccountName(event.target.value)}/><input inputMode="decimal" placeholder="الرصيد الحالي" value={accountBalance} onChange={(event) => setAccountBalance(event.target.value)}/><input inputMode="decimal" placeholder="المساهمة الشهرية" value={accountMonthly} onChange={(event) => setAccountMonthly(event.target.value)}/></FormDialog>}
          {goalFormOpen && <FormDialog title="إضافة هدف مالي" onClose={() => setGoalFormOpen(false)} onSubmit={addGoal} busy={busy} error={error}><input placeholder="اسم الهدف" value={goalName} onChange={(event) => setGoalName(event.target.value)}/><input inputMode="decimal" placeholder="المبلغ المستهدف" value={goalTarget} onChange={(event) => setGoalTarget(event.target.value)}/><input inputMode="decimal" placeholder="المساهمة الشهرية" value={goalMonthly} onChange={(event) => setGoalMonthly(event.target.value)}/></FormDialog>}
        </AnimatePresence>
      </motion.div>
    </motion.section>
  )
}

function FormDialog({ title, onClose, onSubmit, busy, error, children }: { title: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean; error: string; children: React.ReactNode }) {
  const dialogRef = useDialog<HTMLFormElement>(onClose)
  return <motion.div className="wealth-form-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}><motion.form ref={dialogRef} className="wealth-form-dialog" role="dialog" aria-modal="true" aria-label={title} initial={{ y: 30, scale: .96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, scale: .96 }} onSubmit={onSubmit} onClick={(event) => event.stopPropagation()}><span>رُشد الخاص</span><h2>{title}</h2>{children}{error && <div className="inline-form-error" role="alert">{error}</div>}<div><button type="button" onClick={onClose}>إلغاء</button><button type="submit" disabled={busy}>{busy ? 'جاري الحفظ…' : 'حفظ'}</button></div></motion.form></motion.div>
}
