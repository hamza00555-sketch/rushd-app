import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
  getWealthUserId,
  loadWealthData,
} from '../lib/wealthRepository'
import { isSupabaseConfigured } from '../lib/supabase'

const demoAccounts: InvestmentAccount[] = [
  { id: 'darahim', name: 'استثمار دراهم', type: 'investment', balance: 18000, monthlyContribution: 2000, annualReturn: 7, icon: '↗' },
  { id: 'emergency', name: 'احتياطي الطوارئ', type: 'cash', balance: 15000, monthlyContribution: 1000, annualReturn: 0, icon: '🛡️' },
  { id: 'noor', name: 'محفظة نور', type: 'child', balance: 2400, monthlyContribution: 100, annualReturn: 6, icon: '🧸' },
]

const demoGoals: FinancialGoal[] = [
  { id: 'goal-emergency', name: 'إكمال صندوق الطوارئ', target: 20000, saved: 15000, monthlyContribution: 1000, priority: 'high', linkedWish: 'صندوق الطوارئ', icon: '🛡️' },
  { id: 'goal-travel', name: 'رحلة العائلة', target: 20000, saved: 12000, monthlyContribution: 800, priority: 'medium', linkedWish: 'رحلة العائلة', icon: '✈️' },
  { id: 'goal-home', name: 'تأثيث البيت', target: 35000, saved: 18500, monthlyContribution: 1200, priority: 'medium', linkedWish: 'تأثيث البيت', icon: '🛋️' },
]

export function WealthPlanner({ onClose }: { onClose: () => void }) {
  const [accounts, setAccounts] = useState<InvestmentAccount[]>(demoAccounts)
  const [goals, setGoals] = useState<FinancialGoal[]>(demoGoals)
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

  const snapshot = useMemo(() => buildWealthSnapshot(accounts, goals), [accounts, goals])
  const projections = useMemo(() => buildProjectionPoints(accounts), [accounts])
  const maxProjection = Math.max(...projections.map((point) => point.value), 1)
  const insight = getWealthInsight(snapshot)

  useEffect(() => {
    let active = true
    if (!isSupabaseConfigured) return
    void getWealthUserId()
      .then(async (userId) => {
        if (!active || !userId) return
        const data = await loadWealthData(userId)
        if (!active) return
        if (data.accounts.length) setAccounts(data.accounts)
        if (data.goals.length) setGoals(data.goals)
        setCloudReady(true)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'تعذر تحميل بيانات الثروة.')
      })
    return () => { active = false }
  }, [])

  const addAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const balance = Number(accountBalance)
    const monthlyContribution = Number(accountMonthly)
    if (!accountName.trim() || balance < 0 || monthlyContribution < 0) return
    const input = { name: accountName.trim(), type: 'investment' as const, balance, monthlyContribution, annualReturn: 7, icon: '↗' }
    setBusy(true)
    setError('')
    try {
      if (isSupabaseConfigured) {
        const userId = await getWealthUserId()
        if (!userId) throw new Error('سجل الدخول من مساحة العائلة لحفظ الحساب في السحابة.')
        const saved = await createInvestmentAccount(userId, input)
        setAccounts((current) => [...current, saved])
        setCloudReady(true)
      } else {
        setAccounts((current) => [...current, { ...input, id: `session-${Date.now()}` }])
      }
      setAccountFormOpen(false)
      setAccountName('')
      setAccountBalance('')
      setAccountMonthly('')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'تعذر إضافة الحساب.')
    } finally {
      setBusy(false)
    }
  }

  const addGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const target = Number(goalTarget)
    const monthlyContribution = Number(goalMonthly)
    if (!goalName.trim() || target <= 0 || monthlyContribution < 0) return
    const input = { name: goalName.trim(), target, saved: 0, monthlyContribution, priority: 'medium' as const, linkedWish: goalName.trim(), icon: '◎' }
    setBusy(true)
    setError('')
    try {
      if (isSupabaseConfigured) {
        const userId = await getWealthUserId()
        if (!userId) throw new Error('سجل الدخول من مساحة العائلة لحفظ الهدف في السحابة.')
        const saved = await createFinancialGoal(userId, input)
        setGoals((current) => [...current, saved])
        setCloudReady(true)
      } else {
        setGoals((current) => [...current, { ...input, id: `session-${Date.now()}` }])
      }
      setGoalFormOpen(false)
      setGoalName('')
      setGoalTarget('')
      setGoalMonthly('')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'تعذر إضافة الهدف.')
    } finally {
      setBusy(false)
    }
  }

  const contribute = async (goal: FinancialGoal, amount: number) => {
    setBusy(true)
    setError('')
    try {
      if (isSupabaseConfigured && !goal.id.startsWith('session-')) {
        const userId = await getWealthUserId()
        if (!userId) throw new Error('سجل الدخول لإضافة المساهمة.')
        await addGoalContribution(userId, goal, amount)
      }
      setGoals((current) => current.map((item) => item.id === goal.id ? { ...item, saved: item.saved + amount } : item))
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'تعذر تسجيل المساهمة.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.section className="wealth-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="wealth-sheet" initial={{ y: 70, scale: .98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 70, scale: .98 }}>
        <header className="wealth-header">
          <button type="button" className="wealth-close" onClick={onClose}>×</button>
          <div><span>الاستثمارات والأهداف</span><h1>خلّ فلوسك تعرف وين رايحة.</h1><p>كل مساهمة شهرية مرتبطة بهدف وموعد واضح، مو مجرد رقم في محفظة.</p></div>
          <div className="wealth-character"><RushdCharacter mood="happy" size="sm" message={insight}/></div>
        </header>

        {error && <div className="wealth-message">{error}</div>}

        <nav className="wealth-tabs">
          <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>النظرة العامة</button>
          <button className={tab === 'accounts' ? 'active' : ''} onClick={() => setTab('accounts')}>المحافظ</button>
          <button className={tab === 'goals' ? 'active' : ''} onClick={() => setTab('goals')}>الأهداف</button>
        </nav>

        <AnimatePresence mode="wait">
          {tab === 'overview' && (
            <motion.main key="overview" className="wealth-content" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
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
                <div className="wealth-section-title"><div><span>محافظك الخاصة</span><h2>{accounts.length} حسابات</h2></div><small>{cloudReady ? 'محفوظة سحابيًا' : 'معاينة محلية'}</small></div>
                <div className="investment-list">
                  {accounts.map((account) => (
                    <article key={account.id}><span>{account.icon}</span><div><strong>{account.name}</strong><small>مساهمة {formatSar(account.monthlyContribution)} · عائد تقديري {account.annualReturn}%</small></div><b>{formatSar(account.balance)}</b></article>
                  ))}
                </div>
                <button className="wealth-primary-button" onClick={() => setAccountFormOpen(true)}>＋ إضافة محفظة</button>
              </section>
            </motion.main>
          )}

          {tab === 'goals' && (
            <motion.main key="goals" className="wealth-content" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <section className="wealth-card">
                <div className="wealth-section-title"><div><span>أهداف مرتبطة بخطتك</span><h2>{goals.length} أهداف</h2></div><small>{formatSar(snapshot.goalsSaved)} من {formatSar(snapshot.goalsTarget)}</small></div>
                <div className="financial-goals-list">
                  {goals.map((goal) => {
                    const projection = projectGoal(goal)
                    return <article key={goal.id}><span className="goal-plan-icon">{goal.icon}</span><div className="goal-plan-copy"><div><strong>{goal.name}</strong><b>{projection.progress}%</b></div><p>{formatSar(goal.saved)} من {formatSar(goal.target)} · {projection.projectedDate}</p><div className="wealth-progress"><i style={{ width: `${projection.progress}%` }}/></div>{goal.linkedWish && <small>مرتبط بأمنية: {goal.linkedWish}</small>}</div><button disabled={busy || projection.status === 'complete'} onClick={() => void contribute(goal, 250)}>+250</button></article>
                  })}
                </div>
                <button className="wealth-primary-button" onClick={() => setGoalFormOpen(true)}>＋ إضافة هدف مالي</button>
              </section>
            </motion.main>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {accountFormOpen && <FormDialog title="إضافة محفظة" onClose={() => setAccountFormOpen(false)} onSubmit={addAccount} busy={busy}><input placeholder="اسم المحفظة" value={accountName} onChange={(event) => setAccountName(event.target.value)}/><input inputMode="decimal" placeholder="الرصيد الحالي" value={accountBalance} onChange={(event) => setAccountBalance(event.target.value)}/><input inputMode="decimal" placeholder="المساهمة الشهرية" value={accountMonthly} onChange={(event) => setAccountMonthly(event.target.value)}/></FormDialog>}
          {goalFormOpen && <FormDialog title="إضافة هدف مالي" onClose={() => setGoalFormOpen(false)} onSubmit={addGoal} busy={busy}><input placeholder="اسم الهدف" value={goalName} onChange={(event) => setGoalName(event.target.value)}/><input inputMode="decimal" placeholder="المبلغ المستهدف" value={goalTarget} onChange={(event) => setGoalTarget(event.target.value)}/><input inputMode="decimal" placeholder="المساهمة الشهرية" value={goalMonthly} onChange={(event) => setGoalMonthly(event.target.value)}/></FormDialog>}
        </AnimatePresence>
      </motion.div>
    </motion.section>
  )
}

function FormDialog({ title, onClose, onSubmit, busy, children }: { title: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean; children: React.ReactNode }) {
  return <motion.div className="wealth-form-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}><motion.form className="wealth-form-dialog" initial={{ y: 30, scale: .96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, scale: .96 }} onSubmit={onSubmit} onClick={(event) => event.stopPropagation()}><span>رُشد الخاص</span><h2>{title}</h2>{children}<div><button type="button" onClick={onClose}>إلغاء</button><button type="submit" disabled={busy}>{busy ? 'جاري الحفظ…' : 'حفظ'}</button></div></motion.form></motion.div>
}
