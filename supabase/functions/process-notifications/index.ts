import { corsHeaders, json } from '../_shared/http.ts'
import { isCronRequest } from '../_shared/cron-auth.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!isCronRequest(request)) {
      return json({ error: 'Forbidden.' }, 403)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase function environment variables.')
    }

    const headers = {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    }

    const scheduleResponse = await fetch(`${supabaseUrl}/functions/v1/schedule-notifications`, {
      method: 'POST',
      headers,
      body: '{}',
    })
    const schedulePayload = await scheduleResponse.json()

    const dispatchResponse = await fetch(`${supabaseUrl}/functions/v1/dispatch-push-notifications`, {
      method: 'POST',
      headers,
      body: '{}',
    })
    const dispatchPayload = await dispatchResponse.json()

    return json(
      {
        ok: scheduleResponse.ok && dispatchResponse.ok,
        schedule: schedulePayload,
        dispatch: dispatchPayload,
      },
      scheduleResponse.ok && dispatchResponse.ok ? 200 : 500,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return json({ error: message }, 500)
  }
})
