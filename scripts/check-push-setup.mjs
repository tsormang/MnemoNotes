import { accessSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { loadEnvLocal } from './load-env-local.mjs'

loadEnvLocal(process.cwd(), { override: true })

const url = process.env.VITE_SUPABASE_URL
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const checks = []

function pass(label) {
  checks.push({ label, ok: true })
  console.log(`✓ ${label}`)
}

function fail(label, hint) {
  checks.push({ label, ok: false, hint })
  console.log(`✗ ${label}`)
  if (hint) console.log(`  → ${hint}`)
}

function warn(label, hint) {
  checks.push({ label, ok: null, hint })
  console.log(`? ${label}`)
  if (hint) console.log(`  → ${hint}`)
}

console.log('MnemoNotes push + shared-data setup check\n')

if (!url || !publishableKey) {
  fail('.env.local has VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY', 'Copy .env.example → .env.local')
  process.exit(1)
}

pass(`Supabase URL configured (${url})`)

if (!process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL === process.env.SUPABASE_URL) {
  pass('Desktop and scripts can share one Supabase project')
} else {
  warn('SUPABASE_URL differs from VITE_SUPABASE_URL', 'Use the same project ref for desktop and mobile')
}

if (!serviceRoleKey) {
  warn('SUPABASE_SERVICE_ROLE_KEY not set', 'Needed for schema checks and setup scripts')
} else {
  pass('Service role key present (server scripts only)')
}

if (process.env.CRON_SECRET) {
  pass('CRON_SECRET set locally (for reference when configuring Supabase cron)')
} else {
  warn('CRON_SECRET not in .env.local', 'Generate one and add to Supabase Edge Function secrets')
}

if (process.env.FCM_SERVICE_ACCOUNT) {
  pass('FCM_SERVICE_ACCOUNT set locally (for reference when deploying push)')
} else {
  warn(
    'FCM_SERVICE_ACCOUNT not in .env.local',
    'Required for Android background push; in-app data still works without it',
  )
}

const clientKey = serviceRoleKey || publishableKey
const supabase = createClient(url, clientKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const tables = [
  { table: 'notification_jobs', label: 'notification_jobs' },
  { table: 'device_subscriptions', label: 'device_subscriptions (mobile push tokens)' },
]

for (const { table, label } of tables) {
  const { error } = await supabase.from(table).select('*').limit(1)
  if (!error) {
    pass(`${label} table exists`)
    continue
  }
  if (
    error.message.includes('does not exist') ||
    error.code === '42P01' ||
    error.code === 'PGRST205'
  ) {
    fail(`${label} table missing`, 'Run pnpm setup:push-db or apply supabase/hosted-bootstrap.sql')
    continue
  }
  warn(`${label}: ${error.message}`)
}

try {
  accessSync(resolve('.env.production.local'))
  pass('.env.production.local exists (APK will use these Supabase values)')
} catch {
  warn(
    '.env.production.local missing',
    'Copy .env.production.local.example and fill before pnpm build:android',
  )
}

if (existsSync(resolve('android/app/google-services.json'))) {
  pass('android/app/google-services.json present (FCM)')
} else if (existsSync(resolve('android/google-services.json'))) {
  warn(
    'google-services.json is in android/ but must be android/app/google-services.json',
    'Move the file and rebuild the APK',
  )
} else {
  warn(
    'android/app/google-services.json missing',
    'Download from Firebase Console; push will not register until added',
  )
}

const failed = checks.filter((c) => c.ok === false)
console.log('')
if (failed.length > 0) {
  console.log(`${failed.length} required check(s) failed. See docs/desktop-mobile-android-setup.md`)
  process.exit(1)
}

console.log('Checks complete. Review any ? warnings before shipping mobile push.')
