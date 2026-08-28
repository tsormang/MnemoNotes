type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  scope?: string
  [key: string]: unknown
}

function isDevMode(): boolean {
  return import.meta.env.DEV
}

function formatMessage(message: string, context?: LogContext): string {
  const scope = context?.scope ? `[${context.scope}] ` : ''
  return `${scope}${message}`
}

function reportToSentry(level: LogLevel, message: string, error?: unknown) {
  const sentry = (
    globalThis as typeof globalThis & {
      __MNEMO_SENTRY__?: {
        captureMessage: (message: string, level: LogLevel) => void
        captureException: (error: unknown) => void
      }
    }
  ).__MNEMO_SENTRY__

  if (!sentry) return

  if (error) {
    sentry.captureException(error)
    return
  }

  if (level === 'warn' || level === 'error') {
    sentry.captureMessage(message, level)
  }
}

function write(level: LogLevel, message: string, context?: LogContext, error?: unknown) {
  const formatted = formatMessage(message, context)

  if (isDevMode()) {
    const payload = context ? [formatted, context] : [formatted]
    switch (level) {
      case 'debug':
        console.debug(...payload)
        break
      case 'info':
        console.info(...payload)
        break
      case 'warn':
        console.warn(...payload)
        break
      case 'error':
        console.error(...payload, error)
        break
    }
    return
  }

  if (level === 'warn' || level === 'error') {
    reportToSentry(level, formatted, error)
  }
}

export const appLogger = {
  debug(message: string, context?: LogContext) {
    write('debug', message, context)
  },
  info(message: string, context?: LogContext) {
    write('info', message, context)
  },
  warn(message: string, context?: LogContext) {
    write('warn', message, context)
  },
  error(message: string, error?: unknown, context?: LogContext) {
    write('error', message, context, error)
  },
}

export function installRuntimeErrorCapture() {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (event) => {
    appLogger.error('Unhandled runtime error', event.error ?? event.message, {
      scope: 'runtime',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    appLogger.error('Unhandled promise rejection', event.reason, { scope: 'runtime' })
  })
}
