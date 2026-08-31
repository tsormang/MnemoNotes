import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { loadEnvLocal } from './load-env-local.mjs'

loadEnvLocal(process.cwd(), { override: true })

const projectRef = process.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
const fileArgIndex = process.argv.indexOf('--file')
const file = fileArgIndex >= 0 ? resolve(process.cwd(), process.argv[fileArgIndex + 1]) : null
const sql = !file ? process.argv.slice(2).join(' ') : null

if (!projectRef) {
  console.error('Missing hosted project ref in VITE_SUPABASE_URL')
  process.exit(1)
}

if (!file && !sql?.trim()) {
  console.error('Usage: node scripts/run-hosted-sql.mjs --file path/to.sql')
  process.exit(1)
}

const args = [
  'supabase',
  'db',
  'query',
  '--linked',
  '--project-ref',
  projectRef,
]

if (file) {
  args.push('--file', file)
} else {
  args.push(sql)
}

const result = spawnSync('npx', args, {
  stdio: 'inherit',
  env: process.env,
})

process.exit(result.status ?? 1)
