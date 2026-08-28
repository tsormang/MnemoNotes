import * as Sentry from '@sentry/react'
import type { SeverityLevel } from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN

export function initSentry() {
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1,
  })

  ;(
    globalThis as typeof globalThis & {
      __MNEMO_SENTRY__?: {
        captureMessage: (message: string, level: 'warn' | 'error') => void
        captureException: (error: unknown) => void
      }
    }
  ).__MNEMO_SENTRY__ = {
    captureMessage: (message, level) => {
      Sentry.captureMessage(message, level as SeverityLevel)
    },
    captureException: (error) => {
      Sentry.captureException(error)
    },
  }
}
