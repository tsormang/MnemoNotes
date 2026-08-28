import { loadEnvLocal } from './load-env-local.mjs'

loadEnvLocal(process.cwd(), { override: true })

console.log('Creating platform admin (no Supabase CLI required)...')
console.log('')

await import('./create-platform-admin.mjs')
