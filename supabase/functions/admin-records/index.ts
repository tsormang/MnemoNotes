import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type AdminAction =
  | 'set_auth_user_status'
  | 'hard_delete_auth_user'
  | 'set_member_status'
  | 'hard_delete_record'

interface AdminRequest {
  action: AdminAction
  userId?: string
  status?: 'active' | 'inactive'
  table?: string
  recordId?: string
  reason?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const hardDeleteTables = new Set([
  'organizations',
  'organization_members',
  'locations',
  'pharmacy_profiles',
  'personnel',
  'personnel_invites',
  'company_roles',
  'company_role_permissions',
  'calendar_items',
  'shift_assignments',
  'notification_rules',
  'notification_jobs',
])

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error('Missing Supabase function environment variables.')
    }

    const authorization = request.headers.get('Authorization')
    const jwt = authorization?.replace('Bearer ', '')

    if (!jwt) {
      return json({ error: 'Missing bearer token.' }, 401)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const serviceClient = createClient(supabaseUrl, serviceRoleKey)

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return json({ error: 'Invalid bearer token.' }, 401)
    }

    const { data: adminRow, error: adminError } = await serviceClient
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (adminError || !adminRow) {
      return json({ error: 'Platform admin access required.' }, 403)
    }

    const body = (await request.json()) as AdminRequest
    const result = await runAdminAction(serviceClient, body)

    await serviceClient.from('platform_admin_actions').insert({
      actor_user_id: user.id,
      action: body.action,
      target_table: body.table ?? null,
      target_id: body.recordId ?? body.userId ?? null,
      reason: body.reason ?? null,
      metadata: { status: body.status ?? null },
    })

    return json({ result }, 200)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown admin error.' }, 400)
  }
})

async function runAdminAction(
  serviceClient: ReturnType<typeof createClient>,
  body: AdminRequest,
) {
  switch (body.action) {
    case 'set_auth_user_status': {
      assertValue(body.userId, 'userId is required.')
      assertValue(body.status, 'status is required.')

      const { data, error } = await serviceClient.auth.admin.updateUserById(body.userId, {
        ban_duration: body.status === 'inactive' ? '876000h' : 'none',
      })

      if (error) throw error
      return data
    }

    case 'hard_delete_auth_user': {
      assertValue(body.userId, 'userId is required.')
      const { data, error } = await serviceClient.auth.admin.deleteUser(body.userId, false)

      if (error) throw error
      return data
    }

    case 'set_member_status': {
      assertValue(body.recordId, 'recordId is required.')
      assertValue(body.status, 'status is required.')

      const { data, error } = await serviceClient
        .from('organization_members')
        .update({ status: body.status === 'inactive' ? 'disabled' : 'active' })
        .eq('id', body.recordId)
        .select()
        .single()

      if (error) throw error
      return data
    }

    case 'hard_delete_record': {
      assertValue(body.table, 'table is required.')
      assertValue(body.recordId, 'recordId is required.')

      if (!hardDeleteTables.has(body.table)) {
        throw new Error(`Hard delete is not allowed for table: ${body.table}`)
      }

      const { data, error } = await serviceClient
        .from(body.table)
        .delete()
        .eq('id', body.recordId)
        .select()

      if (error) throw error
      return data
    }

    default:
      throw new Error('Unsupported admin action.')
  }
}

function assertValue<T>(value: T | null | undefined, message: string): asserts value is T {
  if (!value) {
    throw new Error(message)
  }
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
