import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function getEnvClients(request: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error('Missing Supabase function environment variables.')
  }

  const authorization = request.headers.get('Authorization')
  const jwt = authorization?.replace('Bearer ', '')

  const serviceClient = createClient(supabaseUrl, serviceRoleKey)
  const userClient = jwt
    ? createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      })
    : null

  return { supabaseUrl, serviceClient, userClient, jwt }
}

export async function requirePlatformAdmin(
  serviceClient: ReturnType<typeof createClient>,
  userClient: ReturnType<typeof createClient> | null,
) {
  if (!userClient) {
    throw new Error('Missing bearer token.')
  }

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    throw new Error('Invalid bearer token.')
  }

  const { data: adminRow, error: adminError } = await serviceClient
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (adminError || !adminRow) {
    throw new Error('Platform admin access required.')
  }

  return user
}

export async function requireOrgPermissions(
  serviceClient: ReturnType<typeof createClient>,
  userClient: ReturnType<typeof createClient>,
  organizationId: string,
  permissions: string[],
) {
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    throw new Error('Invalid bearer token.')
  }

  const { data: adminRow } = await serviceClient
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (adminRow) {
    return user
  }

  const { data: member, error: memberError } = await serviceClient
    .from('organization_members')
    .select('role, status')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (memberError || !member) {
    throw new Error('Not a member of this organization.')
  }

  let userPermissions: string[] = []

  if (member.role === 'owner') {
    const { data: perms, error: permError } = await serviceClient
      .from('role_permissions')
      .select('permission')
      .eq('role', 'owner')

    if (permError) throw permError
    userPermissions = perms?.map((row) => row.permission) ?? []
  } else {
    const { data: personnel, error: personnelError } = await serviceClient
      .from('personnel')
      .select('company_role_id')
      .eq('organization_id', organizationId)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (personnelError || !personnel?.company_role_id) {
      throw new Error('Personnel record not linked.')
    }

    const { data: perms, error: permError } = await serviceClient
      .from('company_role_permissions')
      .select('permission')
      .eq('company_role_id', personnel.company_role_id)

    if (permError) throw permError
    userPermissions = perms?.map((row) => row.permission) ?? []
  }

  for (const permission of permissions) {
    if (!userPermissions.includes(permission)) {
      throw new Error(`Missing permission: ${permission}`)
    }
  }

  return user
}
