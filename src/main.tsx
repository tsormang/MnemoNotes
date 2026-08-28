import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppProviders } from './app/providers.tsx'
import { installRuntimeErrorCapture } from './lib/logger.ts'
import { initSentry } from './lib/sentry.ts'

initSentry()
installRuntimeErrorCapture()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
)
