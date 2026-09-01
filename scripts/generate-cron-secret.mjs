// Generates CRON_SECRET for Supabase Edge Functions.
// Add the output to .env.local AND Supabase Dashboard → Edge Functions → Secrets.

import { randomBytes } from 'node:crypto'

const secret = randomBytes(32).toString('hex')
console.log('Generated CRON_SECRET (save in .env.local and Supabase secrets):\n')
console.log(secret)
