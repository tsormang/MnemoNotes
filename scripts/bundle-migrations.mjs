import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migrationsDir = resolve('supabase/migrations')
const seedPath = resolve('supabase/seed.sql')
const outPath = resolve('supabase/hosted-bootstrap.sql')

const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()

const parts = [
  '-- MnemoNotes hosted bootstrap (migrations + seed)',
  '-- Run once in Supabase Dashboard → SQL Editor if `supabase db push` is unavailable.',
  '',
]

for (const file of migrationFiles) {
  parts.push(`-- === ${file} ===`)
  parts.push(readFileSync(resolve(migrationsDir, file), 'utf8'))
  parts.push('')
}

parts.push('-- === seed.sql ===')
parts.push(readFileSync(seedPath, 'utf8'))

writeFileSync(outPath, parts.join('\n'), 'utf8')
console.log(`Wrote ${outPath} (${migrationFiles.length} migrations + seed)`)
