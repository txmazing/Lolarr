import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@lolarr/ui/styles.css'
import '@lolarr/ui/theme.css'
import App from './App.tsx'
import { initializeSpatialNavigation } from './spatial-navigation'

initializeSpatialNavigation()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
