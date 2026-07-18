import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import App from './App'
import { HouseholdView } from './components/HouseholdView'

export default function AppShell() {
  const [householdOpen, setHouseholdOpen] = useState(false)

  return (
    <>
      <App />
      <motion.button
        type="button"
        className="household-fab"
        onClick={() => setHouseholdOpen(true)}
        aria-label="فتح المساحة العائلية"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3.2, repeat: Infinity }}
      >
        <span>⌂</span>
        <small>العائلة</small>
      </motion.button>
      <AnimatePresence>
        {householdOpen && <HouseholdView onClose={() => setHouseholdOpen(false)} />}
      </AnimatePresence>
    </>
  )
}
