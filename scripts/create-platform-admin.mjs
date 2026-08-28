import { createClient } from '@supabase/supabase-js'
import { loadEnvLocal, validateHostedEnv } from './load-env-local.mjs'

loadEnvLocal(process.cwd(), { override: true })

const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--'))
    .map((arg) => {
      const [key, value = ''] = arg.slice(2).split('=')
      return [key, value]
    }),
)

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = args.get('email') || process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD

const envErrors = validateHostedEnv()
if (envErrors.length > 0) {
  console.error('Invalid Supabase admin environment:\n')
  for (const error of envErrors) {
    console.error(`  • ${error}`)
  }
  process.exit(1)
}

if (!supabaseUrl || !serviceRoleKey || !email || !password) {
  console.error(
    'Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL/--email, or ADMIN_PASSWORD.',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function findUserByEmail(targetEmail) {
  const perPage = 1000

  for (let page = 1; page < 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })

    if (error) {
      throw error
    }

    const match = data.users.find((user) => user.email?.toLowerCase() === targetEmail.toLowerCase())

    if (match || data.users.length < perPage) {
      return match ?? null
    }
  }

  return null
}

async function main() {
  const existingUser = await findUserByEmail(email)
  const userResult = existingUser
    ? await supabase.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: {
          full_name: 'Developer Admin',
        },
      })
    : await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: 'Developer Admin',
        },
      })

  if (userResult.error) {
    throw userResult.error
  }

  const user = userResult.data.user

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: user.id,
    full_name: 'Developer Admin',
    timezone: 'Europe/Athens',
  })

  if (profileError) {
    throw profileError
  }

  const { error: platformAdminError } = await supabase.from('platform_admins').upsert({
    user_id: user.id,
  })

  if (platformAdminError) {
    throw platformAdminError
  }

  console.log(`Platform admin is ready for ${email}.`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
