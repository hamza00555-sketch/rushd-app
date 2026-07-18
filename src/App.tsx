import { useMemo, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RushdCharacter } from './components/RushdCharacter'
import { formatSar, getSpentPercentage } from './lib/finance'
import {
  buildSuggestedBudget,
  getFinancialSignals,
  getFinancialSnapshot,
  type BudgetCategory,
} from './lib/financialEngine'

type Tab = 'home' | 'month' | 'wishes' | 'market'

type Wish = {
  id: number
  title: string
  icon: string
  saved: number
  target: number
  deadline: string
}

type MarketItem = {
  id: number
  title: string
  quantity: string
  owner: 'حمزة' | 'أسماء'
  checked: boolean
}

type Transaction = {
  id: number
  title: string
  amount: number
  categoryId: string
  date: string
}

const initialSalary = 16500

const initialWishes: Wish[] = [
  { id: 1, title: 'رحلة العائلة', icon: '✈️', saved: 12000, target: 20000, deadline: 'باقي 3 أشهر' },
  { id: 2, title: 'تأثيث البيت', icon: '🛋️', saved: 18500, target: 35000, deadline: 'باقي 7 أشهر' },
  { id: 3, title: 'صندوق الطوارئ', icon: '🛡️', saved: 15000, target: 20000, deadline: 'قريب جدًا' },
]

const initialMarketItems: MarketItem[] = [
  { id: 1, title: 'حليب', quantity: '2 عبوة', owner: 'أسماء', checked: false },
  { id: 2, title: 'بيض', quantity: 'طبق كبير', owner: 'حمزة', checked: true },
  { id: 3, title: 'مناديل مطبخ', quantity: '1 كرتون', owner: 'أسماء', checked: false },
  { id: 4, title: 'قهوة', quantity: '500 جم', owner: 'حمزة', checked: false },
]

const initialTransactions: Transaction[] = [
  { id: 1, title: 'إيجار المنزل', amount: 2166, categoryId: 'commitments', date: 'اليوم' },
  { id: 2, title: 'استثمار دراهم', amount: 2000, categoryId: 'future', date: 'أمس' },
  { id: 3, title: 'السوبرماركت', amount: 714, categoryId: 'needs', date: '15 يوليو' },
  { id: 4, title: 'اشتراك النادي', amount: 200, categoryId: 'flex', date: '12 يوليو' },
]

const tabMessages: Record<Tab, string> = {
  home: 'حللت وضع الشهر. عندك مساحة جيدة، لكن الالتزامات تحتاج مراقبة.',
  month: 'غيّر الراتب أو أضف مصروفًا، وأنا أعيد قراءة الخطة فورًا.',
  wishes: 'كل أمنية هنا مرتبطة بخطتك، مو مجرد قائمة أحلام.',
  market: 'القائمة مشتركة، لذلك ما عاد فيه: كنت أحسبك اشتريتها.',
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
  wishes: Wish[]
  pendingMarket: number
  onOpenMonth: () => void
}) {
  const snapshot = getFinancialSnapshot(salary, categories)
  const signals = getFinancialSignals(salary, categories)
  const nearestWish = [...wishes].sort((a, b) => (b.saved / b.target) - (a.saved / a.target))[0]
  const wishProgress = getSpentPercentage(nearestWish.saved, nearestWish.target)

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

      <section className="section-block">
        <div className="section-title"><div><span>الأقرب الآن</span><h2>{nearestWish.title}</h2></div><b>{wishProgress}%</b></div>
        <div className="goal-focus-row"><span className="goal-art">{nearestWish.icon}</span><div><strong>{formatSar(nearestWish.saved)} من {formatSar(nearestWish.target)} ريال</strong><ProgressBar value={wishProgress}/><small>{nearestWish.deadline}</small></div></div>
      </section>

      <section className="living-summary">
        <motion.span animate={{ rotate: [0, 18, 0], scale: [1, 1.2, 1] }} transition={{ duration: 2.8, repeat: Infinity }}>✦</motion.span>
        <div><strong>ملخص البيت</strong><p>{pendingMarket} عناصر في السوبرماركت، وخطتك المالية تتحدث تلقائيًا مع كل مصروف جديد.</p></div>
      </section>
    </motion.main>
  )
}

function MonthView({
  salary,
  salaryDraft,
  setSalaryDraft,
  categories,
  transactions,
  onRebuild,
  onAddExpense,
}: {
  salary: number
  salaryDraft: string
  setSalaryDraft: (value: string) => void
  categories: BudgetCategory[]
  transactions: Transaction[]
  onRebuild: (event: FormEvent<HTMLFormElement>) => void
  onAddExpense: (title: string, amount: number, categoryId: string) => void
}) {
  const snapshot = getFinancialSnapshot(salary, categories)
  const [expenseTitle, setExpenseTitle] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState(categories[0]?.id ?? 'needs')
  const weeklyBars = [41, 58, 46, 72, 64, Math.max(18, snapshot.utilization)]

  const submitExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = Number(expenseAmount)
    if (!expenseTitle.trim() || !Number.isFinite(amount) || amount <= 0) return
    onAddExpense(expenseTitle.trim(), amount, expenseCategory)
    setExpenseTitle('')
    setExpenseAmount('')
  }

  return (
    <motion.main className="screen-content" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
      <section className="month-command-card">
        <span>حساب الشهر</span><h1>راتبك يدخل مرة، والخطة تتغير فورًا.</h1>
        <form className="salary-form" onSubmit={onRebuild}>
          <label><small>الراتب الشهري</small><div><input inputMode="decimal" value={salaryDraft} onChange={(event) => setSalaryDraft(event.target.value)} aria-label="الراتب الشهري"/><b>ريال</b></div></label>
          <button type="submit">بناء الخطة</button>
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
          <button type="submit">＋ تسجيل المصروف</button>
        </form>
      </section>

      <section className="section-block analytics-card">
        <div className="section-title"><div><span>اتجاه الصرف</span><h2>آخر 6 أسابيع</h2></div><b>{snapshot.utilization}%</b></div>
        <div className="weekly-chart" aria-label="رسم اتجاه الصرف">
          {weeklyBars.map((value, index) => <motion.i key={`${value}-${index}`} initial={{ height: 0 }} animate={{ height: `${value}%` }} transition={{ delay: index * 0.08 }}><small>{index + 1}</small></motion.i>)}
        </div>
      </section>

      <section className="section-block transaction-section">
        <div className="section-title"><div><span>آخر الحركات</span><h2>سجل المصروفات</h2></div><b>{transactions.length}</b></div>
        {transactions.slice(0, 6).map((transaction) => {
          const category = categories.find((item) => item.id === transaction.categoryId)
          return <article className="transaction-row" key={transaction.id}><span className="transaction-icon">{category?.icon ?? '•'}</span><div><strong>{transaction.title}</strong><small>{category?.title} · {transaction.date}</small></div><b>-{formatSar(transaction.amount)}</b></article>
        })}
      </section>
    </motion.main>
  )
}

function WishesView({ wishes, onAdd }: { wishes: Wish[]; onAdd: () => void }) {
  return (
    <motion.main className="screen-content" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
      <section className="goal-intro wishes-intro"><span>أماني رُشد</span><h1>حوّل الأشياء اللي تتمناها إلى خطة واضحة.</h1><p>كل هدف له مبلغ، تقدم، وموعد تقريبي بدل ما يظل مجرد فكرة.</p></section>
      <div className="goals-list">
        {wishes.map((wish, index) => {
          const value = getSpentPercentage(wish.saved, wish.target)
          return <motion.article className="full-goal-card wish-card" key={wish.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}><span className="goal-emoji">{wish.icon}</span><div><div className="wish-heading"><h2>{wish.title}</h2><b>{value}%</b></div><p>{formatSar(wish.saved)} من {formatSar(wish.target)} ريال</p><ProgressBar value={value}/><small>{wish.deadline}</small></div></motion.article>
        })}
      </div>
      <button type="button" className="primary-button" onClick={onAdd}>＋ إضافة أمنية جديدة</button>
    </motion.main>
  )
}

function MarketView({ items, onToggle, onAdd }: { items: MarketItem[]; onToggle: (id: number) => void; onAdd: () => void }) {
  const checked = items.filter((item) => item.checked).length
  const progress = getSpentPercentage(checked, items.length)

  return (
    <motion.main className="screen-content" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
      <section className="market-hero"><span>السوبرماركت المشترك</span><h1>{items.length - checked} عناصر متبقية</h1><p>القائمة جاهزة للمزامنة بينك وبين أسماء، وكل شخص يعرف مين أضاف كل عنصر.</p><ProgressBar value={progress}/></section>
      <section className="section-block market-list">
        {items.map((item, index) => <motion.button type="button" className={`market-row ${item.checked ? 'is-checked' : ''}`} key={item.id} onClick={() => onToggle(item.id)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07 }}><span className="check-circle">{item.checked ? '✓' : ''}</span><span className="market-copy"><strong>{item.title}</strong><small>{item.quantity} · أضافها {item.owner}</small></span></motion.button>)}
        <button type="button" className="secondary-button" onClick={onAdd}>＋ إضافة عنصر</button>
      </section>
      <section className="shared-status"><span className="live-dot"/><div><strong>جاهز للربط الحقيقي</strong><p>الواجهة والتدفق مكتملان، وتفعيل Supabase يحتاج بيانات المشروع فقط.</p></div></section>
    </motion.main>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [salary, setSalary] = useState(initialSalary)
  const [salaryDraft, setSalaryDraft] = useState(String(initialSalary))
  const [categories, setCategories] = useState(() => buildSuggestedBudget(initialSalary))
  const [transactions, setTransactions] = useState(initialTransactions)
  const [wishes, setWishes] = useState(initialWishes)
  const [items, setItems] = useState(initialMarketItems)
  const [message, setMessage] = useState(tabMessages.home)
  const [counter, setCounter] = useState(0)

  const mood = useMemo(() => tab === 'month' || tab === 'market' ? 'thinking' : tab === 'wishes' ? 'happy' : 'calm', [tab])
  const pendingMarket = items.filter((item) => !item.checked).length

  const changeTab = (next: Tab) => {
    setTab(next)
    setMessage(tabMessages[next])
  }

  const rebuildPlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextSalary = Number(salaryDraft)
    if (!Number.isFinite(nextSalary) || nextSalary <= 0) {
      setMessage('اكتب راتبًا صحيحًا أولًا، وبعدها أبني لك الخطة.')
      return
    }
    setSalary(nextSalary)
    setCategories((current) => buildSuggestedBudget(nextSalary, current))
    setMessage('أعدت توزيع الراتب مع الحفاظ على مصروفاتك الحالية.')
  }

  const addExpense = (title: string, amount: number, categoryId: string) => {
    setCategories((current) => current.map((category) => category.id === categoryId ? { ...category, spent: category.spent + amount } : category))
    setTransactions((current) => [{ id: Date.now(), title, amount, categoryId, date: 'الآن' }, ...current])
    const category = categories.find((item) => item.id === categoryId)
    const projected = (category?.spent ?? 0) + amount
    setMessage(projected > (category?.limit ?? Number.POSITIVE_INFINITY) ? `انتبه: ${category?.title} تجاوزت الميزانية بعد هذا المصروف.` : 'تم تسجيل المصروف وتحديث التحليل فورًا.')
  }

  const addWish = () => {
    setWishes((current) => [...current, { id: Date.now(), title: 'جهاز جديد', icon: '💻', saved: 0, target: 8000, deadline: 'هدف جديد' }])
    setMessage('أضفت أمنية جديدة. نموذج التفاصيل الكامل يأتي في تطوير الأماني.')
  }

  const addMarketItem = () => {
    setItems((current) => [...current, { id: Date.now(), title: 'عنصر جديد', quantity: 'حدد الكمية', owner: 'حمزة', checked: false }])
    setMessage('تمت إضافة العنصر للقائمة المشتركة.')
  }

  const pressCharacter = () => {
    const snapshot = getFinancialSnapshot(salary, categories)
    const messages = [
      `باقي معك ${formatSar(snapshot.remaining)} ريال من راتب هذا الشهر.`,
      snapshot.watch ? `عندك ${snapshot.watch} فئات تحتاج متابعة.` : 'كل ميزانياتك حاليًا في النطاق الآمن.',
      'أي مصروف جديد يغيّر قراءتي مباشرة، فلا تعتمد على التقدير.',
    ]
    const next = counter + 1
    setCounter(next)
    setMessage(messages[next % messages.length])
  }

  return (
    <div className="app-canvas">
      <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
      <div className="phone-app">
        <header className="topbar"><div className="profile"><span className="avatar">ح</span><div><small>مساء الخير</small><strong>حمزة</strong></div></div><div className="sprint-badge"><span className="live-dot"/>Sprint 03</div></header>
        <div className="character-dock"><RushdCharacter mood={mood} size="sm" message={message} interactive onPress={pressCharacter}/></div>
        <AnimatePresence mode="wait">
          {tab === 'home' && <HomeView key="home" salary={salary} categories={categories} wishes={wishes} pendingMarket={pendingMarket} onOpenMonth={() => changeTab('month')}/>} 
          {tab === 'month' && <MonthView key="month" salary={salary} salaryDraft={salaryDraft} setSalaryDraft={setSalaryDraft} categories={categories} transactions={transactions} onRebuild={rebuildPlan} onAddExpense={addExpense}/>} 
          {tab === 'wishes' && <WishesView key="wishes" wishes={wishes} onAdd={addWish}/>} 
          {tab === 'market' && <MarketView key="market" items={items} onToggle={(id) => setItems((current) => current.map((item) => item.id === id ? { ...item, checked: !item.checked } : item))} onAdd={addMarketItem}/>} 
        </AnimatePresence>
        <nav className="bottom-nav sprint-nav sprint03-nav" aria-label="التنقل الرئيسي">
          <button type="button" className={tab === 'home' ? 'active' : ''} onClick={() => changeTab('home')}><span>⌂</span><small>الرئيسية</small></button>
          <button type="button" className={tab === 'month' ? 'active' : ''} onClick={() => changeTab('month')}><span>◫</span><small>حساب الشهر</small></button>
          <button type="button" className={tab === 'wishes' ? 'active' : ''} onClick={() => changeTab('wishes')}><span>♡</span><small>الأماني</small></button>
          <button type="button" className={tab === 'market' ? 'active' : ''} onClick={() => changeTab('market')}><span>🛒</span><small>السوبرماركت</small></button>
        </nav>
      </div>
    </div>
  )
}
