import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from './components/Icon'
import { RushdCharacter } from './components/RushdCharacter'
import { formatSar, getSpentPercentage, monthlyAllocations } from './lib/finance'

type Tab = 'home' | 'month' | 'goals' | 'insights'

type Transaction = {
  title: string
  category: string
  amount: number
  icon: string
}

const transactions: Transaction[] = [
  { title: 'سوبر ماركت', category: 'مشتريات المنزل', amount: -87.5, icon: '🛒' },
  { title: 'راتب يوليو', category: 'دخل شهري', amount: 25680, icon: '↗' },
  { title: 'أماني رُشد', category: 'تحويل تلقائي', amount: -500, icon: '♡' },
]

const tabCopy: Record<Tab, { title: string; message: string }> = {
  home: { title: 'الرئيسية', message: 'وضعك مطمئن، وخطتك ماشية بشكل جميل.' },
  month: { title: 'حساب الشهر', message: 'وزّعنا الراتب بدون ما ننسى مستقبلك.' },
  goals: { title: 'الأهداف', message: 'أقرب هدف لك صار على بُعد خطوات.' },
  insights: { title: 'التحليلات', message: 'وجدت نمطًا بسيطًا يوفّر عليك هذا الشهر.' },
}

function ProgressRing({ value }: { value: number }) {
  const radius = 43
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="progress-ring" aria-label={`مؤشر رشد ${value}%`}>
      <svg viewBox="0 0 108 108">
        <circle className="ring-track" cx="54" cy="54" r={radius} />
        <motion.circle
          className="ring-value"
          cx="54"
          cy="54"
          r={radius}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      </svg>
      <div className="ring-label">
        <strong>{value}%</strong>
        <span>مؤشر رُشد</span>
      </div>
    </div>
  )
}

function HomeView({ onCelebrate }: { onCelebrate: () => void }) {
  return (
    <motion.main className="screen-content" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
      <section className="hero-card">
        <div>
          <span className="eyebrow">مساء الخير يا حمزة</span>
          <h1>أنت على المسار الصحيح</h1>
          <p>استمر. مستقبلك المالي يُبنى بهدوء.</p>
        </div>
        <ProgressRing value={72} />
        <div className="living-line" aria-hidden="true"><span/><span/><span/><span/><span/><span/></div>
      </section>

      <section className="metrics-grid">
        <article className="metric-card accent-card">
          <span>إجمالي الرصيد</span>
          <strong>{formatSar(25680)}</strong>
          <small>SAR · أعلى 12% من الشهر الماضي</small>
        </article>
        <article className="metric-card">
          <span>المتبقي للمصروف</span>
          <strong>{formatSar(7140)}</strong>
          <div className="mini-progress"><i style={{ width: '72%' }} /></div>
        </article>
      </section>

      <section className="section-block">
        <div className="section-title">
          <div><span>أقرب هدف</span><h2>رحلة العائلة</h2></div>
          <button type="button" className="text-button">كل الأهداف</button>
        </div>
        <article className="goal-card">
          <div className="goal-art">✈</div>
          <div className="goal-copy">
            <div className="goal-meta"><strong>12,000</strong><span>من 20,000 ريال</span></div>
            <div className="goal-track"><motion.i initial={{ width: 0 }} animate={{ width: '60%' }} transition={{ duration: 0.9 }} /></div>
            <small>باقي 3 أشهر حسب خطتك الحالية</small>
          </div>
          <button type="button" className="celebrate-button" onClick={onCelebrate} aria-label="شجّعني"><Icon name="spark" size={18}/></button>
        </article>
      </section>

      <section className="section-block">
        <div className="section-title"><div><span>اليوم</span><h2>آخر الحركات</h2></div><button type="button" className="text-button">عرض الكل</button></div>
        <div className="transaction-list">
          {transactions.map((item, index) => (
            <motion.article className="transaction-row" key={item.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 * index }}>
              <span className="transaction-icon">{item.icon}</span>
              <div><strong>{item.title}</strong><small>{item.category}</small></div>
              <b className={item.amount > 0 ? 'positive' : ''}>{item.amount > 0 ? '+' : ''}{formatSar(item.amount)}</b>
            </motion.article>
          ))}
        </div>
      </section>
    </motion.main>
  )
}

function MonthView() {
  return (
    <motion.main className="screen-content" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
      <section className="month-summary">
        <span>راتب يوليو</span><strong>{formatSar(25680)} <small>SAR</small></strong>
        <div className="month-stats"><div><b>18,540</b><span>المصروف</span></div><div><b>7,140</b><span>المتبقي</span></div><div><b>28%</b><span>ادخار</span></div></div>
      </section>
      <section className="section-block">
        <div className="section-title"><div><span>خطة ذكية</span><h2>توزيع الشهر</h2></div><span className="status-pill">متوازن</span></div>
        <div className="allocation-list">
          {monthlyAllocations.map((item, index) => {
            const percent = Math.round(item.amount / 130)
            return (
              <article className="allocation-row" key={item.label}>
                <div className={`allocation-dot ${item.tone}`} />
                <div className="allocation-copy"><div><strong>{item.label}</strong><b>{formatSar(item.amount)}</b></div><div className="allocation-track"><motion.i className={item.tone} initial={{ width: 0 }} animate={{ width: `${Math.min(percent, 100)}%` }} transition={{ delay: index * 0.12, duration: 0.75 }} /></div></div>
              </article>
            )
          })}
        </div>
        <button type="button" className="primary-button">تعديل التوزيع</button>
      </section>
      <section className="rushd-tip"><Icon name="spark"/><div><strong>ملاحظة من رُشد</strong><p>توزيعك الحالي يحافظ على الأمان، وفي نفس الوقت يترك مساحة للحياة.</p></div></section>
    </motion.main>
  )
}

function GoalsView() {
  const goals = [
    { title: 'رحلة العائلة', amount: '12,000 / 20,000', value: 60, icon: '✈️' },
    { title: 'تأثيث البيت', amount: '18,500 / 35,000', value: 53, icon: '🛋️' },
    { title: 'صندوق الطوارئ', amount: '15,000 / 20,000', value: 75, icon: '🛡️' },
  ]
  return (
    <motion.main className="screen-content" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
      <section className="goal-intro"><span>أهداف واقعية</span><h1>كل خطوة صغيرة تبني مستقبلًا أوضح.</h1></section>
      <div className="goals-list">
        {goals.map((goal, index) => (
          <motion.article className="full-goal-card" key={goal.title} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .12 }}>
            <span className="goal-emoji">{goal.icon}</span>
            <div><h2>{goal.title}</h2><p>{goal.amount} ريال</p><div className="goal-track"><motion.i initial={{ width: 0 }} animate={{ width: `${goal.value}%` }} /></div><small>{goal.value}% مكتمل</small></div>
          </motion.article>
        ))}
      </div>
      <button type="button" className="primary-button"><Icon name="plus" size={18}/> هدف جديد</button>
    </motion.main>
  )
}

function InsightsView() {
  const spent = getSpentPercentage(7140, 10000)
  return (
    <motion.main className="screen-content" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
      <section className="insight-hero"><Icon name="spark" size={28}/><span>اكتشاف هذا الأسبوع</span><h1>صرف المطاعم أقل بـ 18% من الشهر الماضي.</h1><p>هذا وفّر لك تقريبًا 280 ريال بدون ما تحس.</p></section>
      <section className="section-block">
        <div className="section-title"><div><span>ميزانية المنزل</span><h2>السوبر ماركت</h2></div><b>{spent}%</b></div>
        <div className="large-progress"><motion.i initial={{ width: 0 }} animate={{ width: `${spent}%` }} /></div>
        <div className="spend-scale"><span>مستخدم 714 ريال</span><span>من 1,000 ريال</span></div>
      </section>
      <section className="insight-list">
        <article><span>أفضل قرار</span><strong>التحويل التلقائي لأماني رُشد</strong><p>ثبّت تقدمك حتى في الأسابيع المزدحمة.</p></article>
        <article><span>فرصة بسيطة</span><strong>راجع اشتراكًا لم تستخدمه</strong><p>قد توفر 49 ريال شهريًا.</p></article>
      </section>
    </motion.main>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [celebrating, setCelebrating] = useState(false)
  const [characterMessage, setCharacterMessage] = useState(tabCopy.home.message)
  const [interactionCount, setInteractionCount] = useState(0)

  const mood = useMemo(() => celebrating ? 'celebrate' : tab === 'insights' ? 'thinking' : tab === 'goals' ? 'happy' : 'calm', [celebrating, tab])

  const changeTab = (next: Tab) => {
    setTab(next)
    setCelebrating(false)
    setCharacterMessage(tabCopy[next].message)
  }

  const handleCharacterPress = () => {
    const messages = ['أنا معك خطوة بخطوة.', 'مو كل تقدم لازم يكون سريعًا.', 'خطتك اليوم أوضح من أمس.', 'باقي القليل على هدفك الأقرب.']
    const next = interactionCount + 1
    setInteractionCount(next)
    setCharacterMessage(messages[next % messages.length])
  }

  const celebrate = () => {
    setCelebrating(true)
    setCharacterMessage('يا سلام! تقدّمك حقيقي ويستاهل الاحتفال ✦')
    window.setTimeout(() => setCelebrating(false), 3200)
  }

  return (
    <div className="app-canvas">
      <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
      <div className="phone-app">
        <header className="topbar">
          <div className="profile"><span className="avatar">ح</span><div><small>مساء الخير</small><strong>حمزة</strong></div></div>
          <div className="topbar-actions"><button type="button" aria-label="التنبيهات"><Icon name="bell"/></button><span className="online-dot"/></div>
        </header>

        <div className="character-dock">
          <RushdCharacter mood={mood} size="sm" message={characterMessage} interactive onPress={handleCharacterPress}/>
        </div>

        <AnimatePresence mode="wait">
          {tab === 'home' && <HomeView key="home" onCelebrate={celebrate}/>} 
          {tab === 'month' && <MonthView key="month"/>}
          {tab === 'goals' && <GoalsView key="goals"/>}
          {tab === 'insights' && <InsightsView key="insights"/>}
        </AnimatePresence>

        <nav className="bottom-nav" aria-label="التنقل الرئيسي">
          <button type="button" className={tab === 'home' ? 'active' : ''} onClick={() => changeTab('home')}><Icon name="home"/><span>الرئيسية</span></button>
          <button type="button" className={tab === 'month' ? 'active' : ''} onClick={() => changeTab('month')}><Icon name="wallet"/><span>حساب الشهر</span></button>
          <button type="button" className="main-action" aria-label="إضافة"><Icon name="plus" size={26}/></button>
          <button type="button" className={tab === 'goals' ? 'active' : ''} onClick={() => changeTab('goals')}><Icon name="goal"/><span>الأهداف</span></button>
          <button type="button" className={tab === 'insights' ? 'active' : ''} onClick={() => changeTab('insights')}><Icon name="chart"/><span>التحليلات</span></button>
        </nav>
      </div>
    </div>
  )
}
