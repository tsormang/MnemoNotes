import { createClient } from '@supabase/supabase-js'
import { loadEnvLocal } from './load-env-local.mjs'

loadEnvLocal(process.cwd(), { override: true })

const url = process.env.VITE_SUPABASE_URL
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, publishableKey)

const checks = [
  { table: 'profiles', label: 'profiles table' },
  { table: 'platform_admins', label: 'platform_admins table' },
  { table: 'organizations', label: 'organizations table' },
  { table: 'company_roles', label: 'company_roles table' },
]

console.log(`Checking hosted project at ${url}\n`)

for (const check of checks) {
  const { error } = await supabase.from(check.table).select('*', { count: 'exact', head: true })

  if (!error) {
    console.log(`✓ ${check.label} exists`)
    continue
  }

  if (error.message.includes('does not exist') || error.code === '42P01') {
    console.log(`✗ ${check.label} missing — run migrations (supabase db push or hosted-bootstrap.sql)`)
    continue
  }

  console.log(`? ${check.label}: ${error.message}`)
}

console.log('\nNext: npm run setup:hosted')
