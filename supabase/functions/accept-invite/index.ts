import { writeAuditLog } from '../_shared/audit.ts'
import { getEnvClients } from '../_shared/clients.ts'
import { corsHeaders, json } from '../_shared/http.ts'
import { hashToken } from '../_shared/tokens.ts'

interface AcceptInviteRequest {
  token: string
  password: string
  fullName?: string
}

async function acceptOwnerInvite(
  serviceClient: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2').createClient>,
  invite: {
    id: string
    organization_id: string
    email: string
    full_name: string
    expires_at: string
    accepted_at: string | null
    invited_by: string | null
  },
  body: AcceptInviteRequest,
) {
  if (invite.accepted_at) {
    return json({ error: 'Invite has already been accepted.' }, 400)
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return json({ error: 'Invite token has expired.' }, 400)
  }

  const displayName = body.fullName?.trim() || invite.full_name

  const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
    email: invite.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  })

  if (authError || !authUser.user) {
    throw authError ?? new Error('Failed to create user account.')
  }

  await serviceClient
    .from('profiles')
    .update({ full_name: displayName })
    .eq('id', authUser.user.id)

  const { error: memberError } = await serviceClient.from('organization_members').insert({
    organization_id: invite.organization_id,
    user_id: authUser.user.id,
    role: 'owner',
    status: 'active',
    invited_by: invite.invited_by,
  })

  if (memberError) {
    throw memberError
  }

  const { error: acceptError } = await serviceClient
    .from('organization_owner_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  if (acceptError) {
    throw acceptError
  }

  await writeAuditLog(serviceClient, {
    organizationId: invite.organization_id,
    actorUserId: authUser.user.id,
    action: 'owner.invite_accepted',
    entityTable: 'organization_owner_invites',
    entityId: invite.id,
    after: { email: invite.email },
  })

  return json(
    {
      userId: authUser.user.id,
      organizationId: invite.organization_id,
      role: 'owner',
    },
    200,
  )
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { serviceClient } = getEnvClients(request)
    const body = (await request.json()) as AcceptInviteRequest

    if (!body.token?.trim()) {
      return json({ error: 'token is required.' }, 400)
    }
    if (!body.password || body.password.length < 10) {
      return json({ error: 'password must be at least 10 characters.' }, 400)
    }

    const tokenHash = await hashToken(body.token.trim())

    const { data: ownerInvite, error: ownerInviteError } = await serviceClient
      .from('organization_owner_invites')
      .select('id, organization_id, email, full_name, expires_at, accepted_at, invited_by')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (ownerInviteError) {
      throw ownerInviteError
    }

    if (ownerInvite) {
      return acceptOwnerInvite(serviceClient, ownerInvite, body)
    }

    const { data: invite, error: inviteError } = await serviceClient
      .from('personnel_invites')
      .select('id, organization_id, personnel_id, email, expires_at, accepted_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (inviteError || !invite) {
      return json({ error: 'Invalid or expired invite token.' }, 400)
    }

    if (invite.accepted_at) {
      return json({ error: 'Invite has already been accepted.' }, 400)
    }

    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return json({ error: 'Invite token has expired.' }, 400)
    }

    const { data: personnel, error: personnelError } = await serviceClient
      .from('personnel')
      .select('id, full_name, organization_id, profile_id')
      .eq('id', invite.personnel_id)
      .single()

    if (personnelError || !personnel) {
      throw personnelError ?? new Error('Personnel record not found.')
    }

    if (personnel.profile_id) {
      return json({ error: 'Personnel record is already linked to an account.' }, 400)
    }

    const displayName = body.fullName?.trim() || personnel.full_name

    const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
      email: invite.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: displayName },
    })

    if (authError || !authUser.user) {
      throw authError ?? new Error('Failed to create user account.')
    }

    await serviceClient
      .from('profiles')
      .update({ full_name: displayName })
      .eq('id', authUser.user.id)

    const { error: personnelUpdateError } = await serviceClient
      .from('personnel')
      .update({
        profile_id: authUser.user.id,
        full_name: displayName,
        status: 'active',
      })
      .eq('id', personnel.id)

    if (personnelUpdateError) {
      throw personnelUpdateError
    }

    const { error: memberError } = await serviceClient.from('organization_members').insert({
      organization_id: invite.organization_id,
      user_id: authUser.user.id,
      role: 'personnel',
      status: 'active',
      invited_by: null,
    })

    if (memberError) {
      throw memberError
    }

    const { error: acceptError } = await serviceClient
      .from('personnel_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id)

    if (acceptError) {
      throw acceptError
    }

    await writeAuditLog(serviceClient, {
      organizationId: invite.organization_id,
      actorUserId: authUser.user.id,
      action: 'personnel.invite_accepted',
      entityTable: 'personnel',
      entityId: personnel.id,
      after: { email: invite.email },
    })

    return json(
      {
        userId: authUser.user.id,
        organizationId: invite.organization_id,
        personnelId: personnel.id,
        role: 'personnel',
      },
      200,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown accept-invite error.'
    return json({ error: message }, 400)
  }
})
