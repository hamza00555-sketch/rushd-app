import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import App from './App'
import { HouseholdView } from './components/HouseholdView'
import { PromotionSimulator } from './components/PromotionSimulator'
import { WealthPlanner } from './components/WealthPlanner'

type LaunchTool = 'wealth' | 'promotion' | 'household'

const toolCards: Array<{
  id: LaunchTool
  icon: string
  title: string
  description: string
}> = [
  {
    id: 'wealth',
    icon: '◎',
    title: 'الثروة والأهداف',
    description: 'تابع محافظك وأهدافك وتوقعات النمو.',
  },
  {
    id: 'promotion',
    icon: '↗',
    title: 'محاكي الترقية',
    description: 'اختبر زيادة الراتب قبل اتخاذ القرار.',
  },
  {
    id: 'household',
    icon: '⌂',
    title: 'مساحة العائلة',
    description: 'أدر الأعضاء والصلاحيات والمشاركة.',
  },
]

export default function AppShell() {
  const [toolsOpen, setToolsOpen] = useState(false)
  const [householdOpen, setHouseholdOpen] = useState(false)
  const [promotionOpen, setPromotionOpen] = useState(false)
  const [wealthOpen, setWealthOpen] = useState(false)

  const openTool = (tool: LaunchTool) => {
    setToolsOpen(false)
    if (tool === 'household') setHouseholdOpen(true)
    if (tool === 'promotion') setPromotionOpen(true)
    if (tool === 'wealth') setWealthOpen(true)
  }

  return (
    <>
      <App />

      <motion.button
        type="button"
        className="launch-tools-trigger"
        onClick={() => setToolsOpen(true)}
        aria-label="فتح أدوات رُشد"
        whileTap={{ scale: 0.94 }}
      >
        <span aria-hidden="true">✦</span>
        <small>الأدوات</small>
      </motion.button>

      <AnimatePresence>
        {toolsOpen && (
          <motion.div
            className="launch-tools-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setToolsOpen(false)}
          >
            <motion.section
              className="launch-tools-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="أدوات رُشد"
              initial={{ y: 90, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 90, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 330, damping: 31 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="launch-tools-handle" />
              <header>
                <div>
                  <span>اختصارات رُشد</span>
                  <h2>وش تبغى تفتح؟</h2>
                </div>
                <button type="button" onClick={() => setToolsOpen(false)} aria-label="إغلاق الأدوات">×</button>
              </header>

              <div className="launch-tools-grid">
                {toolCards.map((tool) => (
                  <motion.button
                    type="button"
                    className={`launch-tool-card launch-tool-${tool.id}`}
                    key={tool.id}
                    onClick={() => openTool(tool.id)}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span aria-hidden="true">{tool.icon}</span>
                    <div>
                      <strong>{tool.title}</strong>
                      <small>{tool.description}</small>
                    </div>
                    <b aria-hidden="true">←</b>
                  </motion.button>
                ))}
              </div>
            </motion.section>
          </motion.div>
        )}

        {householdOpen && <HouseholdView onClose={() => setHouseholdOpen(false)} />}
        {promotionOpen && <PromotionSimulator onClose={() => setPromotionOpen(false)} />}
        {wealthOpen && <WealthPlanner onClose={() => setWealthOpen(false)} />}
      </AnimatePresence>
    </>
  )
}
