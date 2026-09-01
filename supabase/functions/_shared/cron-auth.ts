import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { json } from './http.ts'

export function isCronRequest(request: Request): boolean {
  const authorization = request.headers.get('Authorization') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET')
  return Boolean(cronSecret && authorization === `Bearer ${cronSecret}`)
}

export async function authorizeNotificationManager(request: Request): Promise<Response | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error('Missing Supabase function environment variables.')
  }

  if (isCronRequest(request)) {
    return null
  }

  const authorization = request.headers.get('Authorization') ?? ''
  const jwt = authorization.replace('Bearer ', '')
  if (!jwt) {
    return json({ error: 'Missing bearer token.' }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return json({ error: 'Invalid session.' }, 401)
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: platformAdmin } = await serviceClient
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!platformAdmin) {
    const { data: memberships } = await serviceClient
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active')

    const orgIds = (memberships ?? []).map((row) => row.organization_id)
    if (orgIds.length === 0) {
      return json({ error: 'Forbidden.' }, 403)
    }

    const { data: personnelRows } = await serviceClient
      .from('personnel')
      .select('company_role_id')
      .eq('profile_id', user.id)
      .in('organization_id', orgIds)

    const roleIds = (personnelRows ?? []).map((row) => row.company_role_id).filter(Boolean)
    const { data: permissions } = await serviceClient
      .from('company_role_permissions')
      .select('permission')
      .in('company_role_id', roleIds)

    const isOwner = (memberships ?? []).some((row) => row.role === 'owner')
    const canManage =
      isOwner || (permissions ?? []).some((row) => row.permission === 'notifications.manage')

    if (!canManage) {
      return json({ error: 'Forbidden.' }, 403)
    }
  }

  return null
}
