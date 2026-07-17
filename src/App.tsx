import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RushdCharacter } from './components/RushdCharacter'
import { formatSar, getSpentPercentage } from './lib/finance'

type Tab = 'home' | 'wishes' | 'market'

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

const tabMessages: Record<Tab, string> = {
  home: 'وضعك مطمئن. خلّنا نكمل الشهر بدون قرارات عشوائية.',
  wishes: 'كل أمنية هنا مرتبطة بخطتك، مو مجرد قائمة أحلام.',
  market: 'القائمة مشتركة، لذلك ما عاد فيه: كنت أحسبك اشتريتها.',
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="goal-track" aria-label={`التقدم ${value}%`}>
      <motion.i initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.7 }} />
    </div>
  )
}

function HomeView({ wishes, pendingMarket }: { wishes: Wish[]; pendingMarket: number }) {
  const totalSaved = wishes.reduce((sum, wish) => sum + wish.saved, 0)
  const totalTargets = wishes.reduce((sum, wish) => sum + wish.target, 0)
  const wishProgress = getSpentPercentage(totalSaved, totalTargets)

  return (
    <motion.main className="screen-content" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <section className="hero-card sprint-hero">
        <div>
          <span className="eyebrow">مؤشر هذا الشهر</span>
          <h1>خطتك ماشية بهدوء، وهذا المطلوب.</h1>
          <p>الادخار مستمر، المصروف تحت السيطرة، وأقرب أمنية وصلت {wishProgress}%.</p>
        </div>
        <motion.div className="pulse-orb" animate={{ scale: [1, 1.08, 1], rotate: [0, 4, 0] }} transition={{ duration: 4, repeat: Infinity }}>
          <strong>{wishProgress}%</strong>
          <span>تقدم الأماني</span>
        </motion.div>
      </section>

      <section className="metrics-grid">
        <article className="metric-card accent-card">
          <span>إجمالي الادخار للأماني</span>
          <strong>{formatSar(totalSaved)}</strong>
          <small>ريال موزعة على {wishes.length} أهداف</small>
        </article>
        <article className="metric-card">
          <span>قائمة البيت</span>
          <strong>{pendingMarket}</strong>
          <small>عناصر بانتظار الشراء</small>
        </article>
      </section>

      <section className="section-block">
        <div className="section-title"><div><span>الأقرب الآن</span><h2>{wishes[2].title}</h2></div><b>{Math.round((wishes[2].saved / wishes[2].target) * 100)}%</b></div>
        <div className="goal-focus-row"><span className="goal-art">{wishes[2].icon}</span><div><strong>{formatSar(wishes[2].saved)} من {formatSar(wishes[2].target)} ريال</strong><ProgressBar value={75}/><small>{wishes[2].deadline}</small></div></div>
      </section>

      <section className="living-summary">
        <motion.span animate={{ x: [0, 8, 0] }} transition={{ duration: 2.8, repeat: Infinity }}>✦</motion.span>
        <div><strong>اقتراح رُشد</strong><p>حوّل 350 ريال إضافية لصندوق الطوارئ، وبتكمل الهدف قبل نهاية الشهر القادم.</p></div>
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
          return (
            <motion.article className="full-goal-card wish-card" key={wish.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
              <span className="goal-emoji">{wish.icon}</span>
              <div><div className="wish-heading"><h2>{wish.title}</h2><b>{value}%</b></div><p>{formatSar(wish.saved)} من {formatSar(wish.target)} ريال</p><ProgressBar value={value}/><small>{wish.deadline}</small></div>
            </motion.article>
          )
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
      <section className="market-hero">
        <span>السوبرماركت المشترك</span><h1>{items.length - checked} عناصر متبقية</h1><p>القائمة متزامنة بينك وبين أسماء، وكل شخص يعرف مين أضاف كل عنصر.</p><ProgressBar value={progress}/>
      </section>
      <section className="section-block market-list">
        {items.map((item, index) => (
          <motion.button type="button" className={`market-row ${item.checked ? 'is-checked' : ''}`} key={item.id} onClick={() => onToggle(item.id)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07 }}>
            <span className="check-circle">{item.checked ? '✓' : ''}</span>
            <span className="market-copy"><strong>{item.title}</strong><small>{item.quantity} · أضافها {item.owner}</small></span>
          </motion.button>
        ))}
        <button type="button" className="secondary-button" onClick={onAdd}>＋ إضافة عنصر</button>
      </section>
      <section className="shared-status"><span className="live-dot"/><div><strong>المزامنة اللحظية جاهزة</strong><p>تعمل محليًا الآن، وتنتظر فقط مفاتيح Supabase للربط الحقيقي بين الأجهزة.</p></div></section>
    </motion.main>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [wishes, setWishes] = useState(initialWishes)
  const [items, setItems] = useState(initialMarketItems)
  const [message, setMessage] = useState(tabMessages.home)
  const [counter, setCounter] = useState(0)

  const mood = useMemo(() => tab === 'market' ? 'thinking' : tab === 'wishes' ? 'happy' : 'calm', [tab])
  const pendingMarket = items.filter((item) => !item.checked).length

  const changeTab = (next: Tab) => {
    setTab(next)
    setMessage(tabMessages[next])
  }

  const addWish = () => {
    const next: Wish = { id: Date.now(), title: 'جهاز جديد', icon: '💻', saved: 0, target: 8000, deadline: 'هدف جديد' }
    setWishes((current) => [...current, next])
    setMessage('أضفت هدفًا تجريبيًا. الخطوة القادمة هي نموذج الإدخال الحقيقي.')
  }

  const addMarketItem = () => {
    setItems((current) => [...current, { id: Date.now(), title: 'عنصر جديد', quantity: 'حدد الكمية', owner: 'حمزة', checked: false }])
    setMessage('تمت الإضافة محليًا. مع Supabase ستظهر فورًا للطرف الثاني.')
  }

  const pressCharacter = () => {
    const messages = ['أنا متابع معك.', 'التقدم الهادئ أفضل من الحماس المؤقت.', 'كل قرار صغير يبان أثره آخر الشهر.']
    const next = counter + 1
    setCounter(next)
    setMessage(messages[next % messages.length])
  }

  return (
    <div className="app-canvas">
      <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
      <div className="phone-app">
        <header className="topbar"><div className="profile"><span className="avatar">ح</span><div><small>مساء الخير</small><strong>حمزة</strong></div></div><div className="sprint-badge"><span className="live-dot"/>Sprint 02</div></header>
        <div className="character-dock"><RushdCharacter mood={mood} size="sm" message={message} interactive onPress={pressCharacter}/></div>
        <AnimatePresence mode="wait">
          {tab === 'home' && <HomeView key="home" wishes={wishes} pendingMarket={pendingMarket}/>} 
          {tab === 'wishes' && <WishesView key="wishes" wishes={wishes} onAdd={addWish}/>} 
          {tab === 'market' && <MarketView key="market" items={items} onToggle={(id) => setItems((current) => current.map((item) => item.id === id ? { ...item, checked: !item.checked } : item))} onAdd={addMarketItem}/>} 
        </AnimatePresence>
        <nav className="bottom-nav sprint-nav" aria-label="التنقل الرئيسي">
          <button type="button" className={tab === 'home' ? 'active' : ''} onClick={() => changeTab('home')}><span>⌂</span><small>الرئيسية</small></button>
          <button type="button" className={tab === 'wishes' ? 'active' : ''} onClick={() => changeTab('wishes')}><span>♡</span><small>الأماني</small></button>
          <button type="button" className={tab === 'market' ? 'active' : ''} onClick={() => changeTab('market')}><span>🛒</span><small>السوبرماركت</small></button>
        </nav>
      </div>
    </div>
  )
}
