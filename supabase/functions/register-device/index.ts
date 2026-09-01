import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/http.ts'

type RegisterAction = 'register' | 'unregister'

interface RegisterBody {
  action?: RegisterAction
  token?: string
  platform?: 'android' | 'ios' | 'web'
  channel?: 'fcm' | 'web_push'
  organizationId?: string
  deviceLabel?: string
}

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

    const body = (await request.json()) as RegisterBody
    const action = body.action ?? 'register'

    if (action === 'unregister') {
      if (!body.token) {
        return json({ error: 'token is required.' }, 400)
      }

      const serviceClient = createClient(supabaseUrl, serviceRoleKey)
      const { error } = await serviceClient
        .from('device_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('token', body.token)

      if (error) throw error
      return json({ ok: true }, 200)
    }

    if (!body.token || !body.organizationId) {
      return json({ error: 'token and organizationId are required.' }, 400)
    }

    const platform = body.platform ?? 'android'
    const channel = body.channel ?? 'fcm'

    const serviceClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: membership } = await serviceClient
      .from('organization_members')
      .select('organization_id')
      .eq('organization_id', body.organizationId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!membership) {
      return json({ error: 'Forbidden.' }, 403)
    }

    const { error } = await serviceClient.from('device_subscriptions').upsert(
      {
        user_id: user.id,
        organization_id: body.organizationId,
        platform,
        channel,
        token: body.token,
        device_label: body.deviceLabel ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,platform,token' },
    )

    if (error) throw error
    return json({ ok: true }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return json({ error: message }, 500)
  }
})
