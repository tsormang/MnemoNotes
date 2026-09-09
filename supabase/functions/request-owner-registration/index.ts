import { getEnvClients } from '../_shared/clients.ts'
import { corsHeaders, json } from '../_shared/http.ts'

interface RequestOwnerRegistrationBody {
  email?: string
  password?: string
  fullName?: string
  companyName?: string
  timezone?: string
}

const GENERIC_OK = { ok: true as const }

function isAlreadyRegisteredError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return (
    lower.includes('already been registered') ||
    lower.includes('already registered') ||
    lower.includes('user already exists') ||
    lower.includes('duplicate')
  )
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { serviceClient } = getEnvClients(request)
    const body = (await request.json()) as RequestOwnerRegistrationBody

    const email = body.email?.trim().toLowerCase() ?? ''
    const password = body.password?.trim() ?? ''
    const fullName = body.fullName?.trim() ?? ''
    const companyName = body.companyName?.trim() ?? ''
    const timezone = body.timezone?.trim() || 'Europe/Athens'

    if (!email || !email.includes('@')) {
      return json({ error: 'A valid email is required.' }, 400)
    }
    if (password.length < 10) {
      return json({ error: 'Password must be at least 10 characters.' }, 400)
    }
    if (fullName.length < 2) {
      return json({ error: 'Full name is required.' }, 400)
    }
    if (companyName.length < 2) {
      return json({ error: 'Company name is required.' }, 400)
    }

    const { data: existingPending, error: pendingError } = await serviceClient
      .from('organization_registration_requests')
      .select('id')
      .eq('status', 'pending')
      .ilike('email', email)
      .maybeSingle()

    if (pendingError) {
      throw pendingError
    }

    if (existingPending) {
      return json(GENERIC_OK)
    }

    const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { full_name: fullName },
    })

    if (authError || !authUser.user) {
      if (isAlreadyRegisteredError(authError)) {
        return json(GENERIC_OK)
      }
      throw authError ?? new Error('Could not create registration.')
    }

    const userId = authUser.user.id

    await serviceClient.from('profiles').update({ full_name: fullName, timezone }).eq('id', userId)

    const { error: insertError } = await serviceClient.from('organization_registration_requests').insert({
      email,
      full_name: fullName,
      company_name: companyName,
      timezone,
      auth_user_id: userId,
      status: 'pending',
    })

    if (insertError) {
      await serviceClient.auth.admin.deleteUser(userId)
      if (isAlreadyRegisteredError(insertError)) {
        return json(GENERIC_OK)
      }
      throw insertError
    }

    return json(GENERIC_OK)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not submit registration.'
    return json({ error: message }, 400)
  }
})
