import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import App from './App'
import { HouseholdView } from './components/HouseholdView'
import { PromotionSimulator } from './components/PromotionSimulator'

export default function AppShell() {
  const [householdOpen, setHouseholdOpen] = useState(false)
  const [promotionOpen, setPromotionOpen] = useState(false)

  return (
    <>
      <App />
      <div className="command-fabs" aria-label="أدوات رُشد السريعة">
        <motion.button
          type="button"
          className="promotion-fab"
          onClick={() => setPromotionOpen(true)}
          aria-label="فتح محاكي الترقية"
          animate={{ y: [0, -5, 0], rotate: [0, -1, 0] }}
          transition={{ duration: 3.5, repeat: Infinity }}
        >
          <span>↗</span>
          <small>الترقية</small>
        </motion.button>
        <motion.button
          type="button"
          className="household-fab"
          onClick={() => setHouseholdOpen(true)}
          aria-label="فتح المساحة العائلية"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, delay: .4 }}
        >
          <span>⌂</span>
          <small>العائلة</small>
        </motion.button>
      </div>
      <AnimatePresence>
        {householdOpen && <HouseholdView onClose={() => setHouseholdOpen(false)} />}
        {promotionOpen && <PromotionSimulator onClose={() => setPromotionOpen(false)} />}
      </AnimatePresence>
    </>
  )
}
