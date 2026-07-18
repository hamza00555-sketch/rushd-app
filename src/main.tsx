import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppShell from './AppShell'
import './styles.css'
import './sprint02.css'
import './sprint03.css'
import './sprint04.css'
import './sprint05.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
)
