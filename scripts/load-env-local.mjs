import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Loads `.env.local` into process.env (does not override existing env vars).
 */
export function loadEnvLocal(rootDir = process.cwd(), { override = false } = {}) {
  const envPath = resolve(rootDir, '.env.local')

  if (!existsSync(envPath)) {
    return false
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()

    if (!key) continue
    if (!override && process.env[key] !== undefined) continue
    process.env[key] = value
  }

  return true
}

export function validateHostedEnv() {
  const errors = []
  const publishable = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL

  if (!url || url.includes('127.0.0.1')) {
    errors.push('Set VITE_SUPABASE_URL and SUPABASE_URL to your hosted https://*.supabase.co URL.')
  }

  if (!publishable) {
    errors.push('Set VITE_SUPABASE_PUBLISHABLE_KEY (publishable/anon key from Supabase Dashboard → API).')
  }

  if (!serviceRole) {
    errors.push('Set SUPABASE_SERVICE_ROLE_KEY (service_role secret from Supabase Dashboard → API).')
  } else if (serviceRole.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(atob(serviceRole.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (payload.role === 'anon') {
        errors.push(
          'SUPABASE_SERVICE_ROLE_KEY is the anon JWT. Use service_role → Reveal in Dashboard → API.',
        )
      } else if (payload.role !== 'service_role') {
        errors.push(`SUPABASE_SERVICE_ROLE_KEY JWT role is "${payload.role}", expected service_role.`)
      }
    } catch {
      // not a decodable JWT — continue other checks
    }
  }

  if (
    serviceRole &&
    !errors.some((e) => e.includes('SUPABASE_SERVICE_ROLE_KEY')) &&
    (serviceRole === publishable ||
      serviceRole.startsWith('sb_publishable_') ||
      serviceRole.includes('publishable'))
  ) {
    errors.push(
      'SUPABASE_SERVICE_ROLE_KEY must be the service_role secret, not the publishable/anon key.',
    )
  }

  if (!process.env.ADMIN_EMAIL) {
    errors.push('Set ADMIN_EMAIL in .env.local for npm run admin:create.')
  }

  if (!process.env.ADMIN_PASSWORD) {
    errors.push('Set ADMIN_PASSWORD in .env.local for npm run admin:create.')
  }

  return errors
}
