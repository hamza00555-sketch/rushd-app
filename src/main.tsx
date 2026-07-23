import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppShell from './AppShell'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import './styles.css'
import './shared-modules.css'
import './finance.css'
import './household.css'
import './promotion.css'
import './wealth.css'
import './launch.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppShell />
    </AppErrorBoundary>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}
