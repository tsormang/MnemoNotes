import { spawnSync } from 'node:child_process'
import { loadEnvLocal } from './load-env-local.mjs'

loadEnvLocal(process.cwd(), { override: true })

const projectRef = process.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
const dbPassword = process.env.SUPABASE_DB_PASSWORD

if (!projectRef) {
  console.error('Could not read project ref from VITE_SUPABASE_URL in .env.local')
  process.exit(1)
}

if (!dbPassword) {
  console.error('Missing SUPABASE_DB_PASSWORD in .env.local.')
  console.error('Dashboard → Project Settings → Database → Database password')
  process.exit(1)
}

function runSupabase(args) {
  const result = spawnSync('npx', ['supabase', ...args], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      SUPABASE_DB_PASSWORD: dbPassword,
      SUPABASE_OUTPUT_FORMAT: undefined,
      CI: undefined,
    },
  })

  if (result.status !== 0) {
    console.error(`\nCommand failed: npx supabase ${args.join(' ')}`)
    process.exit(result.status ?? 1)
  }
}

console.log(`Pushing migrations to ${projectRef}...\n`)
runSupabase(['db', 'push', '--project-ref', projectRef, '--include-seed', '--yes'])

console.log('\nMigrations and seed applied.')
