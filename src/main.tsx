import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import AppShell from './AppShell'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import './styles.css'
import './shared-modules.css'
import './finance.css'
import './launch.css'
import './rebrand.css'
import './visual-brand.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <AppErrorBoundary>
        <AppShell />
      </AppErrorBoundary>
    </MotionConfig>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}
