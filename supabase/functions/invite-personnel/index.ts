import { writeAuditLog } from '../_shared/audit.ts'
import { getEnvClients, requireOrgPermissions } from '../_shared/clients.ts'
import { corsHeaders, json } from '../_shared/http.ts'
import { createInviteToken, hashToken } from '../_shared/tokens.ts'

interface InvitePersonnelRequest {
  organizationId: string
  email: string
  personnelId?: string
  companyRoleId?: string
  locationId?: string
  fullName?: string
  title?: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { serviceClient, userClient } = getEnvClients(request)

    if (!userClient) {
      return json({ error: 'Missing bearer token.' }, 401)
    }

    const body = (await request.json()) as InvitePersonnelRequest

    if (!body.organizationId) {
      return json({ error: 'organizationId is required.' }, 400)
    }
    if (!body.email?.trim()) {
      return json({ error: 'email is required.' }, 400)
    }

    const actor = await requireOrgPermissions(serviceClient, userClient, body.organizationId, [
      'users.invite',
      'personnel.manage',
    ])

    const email = body.email.trim().toLowerCase()

    if (body.personnelId) {
      const { data: existing, error: existingError } = await serviceClient
        .from('personnel')
        .select('id, organization_id, profile_id, full_name')
        .eq('id', body.personnelId)
        .maybeSingle()

      if (existingError || !existing || existing.organization_id !== body.organizationId) {
        return json({ error: 'Personnel record not found for this organization.' }, 404)
      }

      if (existing.profile_id) {
        return json({ error: 'This personnel member already has a linked app account.' }, 400)
      }

      const { data: pendingInvite, error: pendingError } = await serviceClient
        .from('personnel_invites')
        .select('id')
        .eq('personnel_id', existing.id)
        .is('accepted_at', null)
        .maybeSingle()

      if (pendingError) {
        throw pendingError
      }

      if (pendingInvite) {
        return json({ error: 'An invite is already pending for this personnel member.' }, 400)
      }

      const token = createInviteToken()
      const tokenHash = await hashToken(token)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      const { error: inviteError } = await serviceClient.from('personnel_invites').insert({
        organization_id: body.organizationId,
        personnel_id: existing.id,
        email,
        token_hash: tokenHash,
        expires_at: expiresAt,
        invited_by: actor.id,
      })

      if (inviteError) {
        throw inviteError
      }

      const { error: statusError } = await serviceClient
        .from('personnel')
        .update({ status: 'invited' })
        .eq('id', existing.id)

      if (statusError) {
        throw statusError
      }

      await writeAuditLog(serviceClient, {
        organizationId: body.organizationId,
        actorUserId: actor.id,
        action: 'personnel.invited',
        entityTable: 'personnel',
        entityId: existing.id,
        after: { email, mode: 'existing_personnel' },
      })

      const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'
      const acceptUrl = `${siteUrl}/accept-invite?token=${encodeURIComponent(token)}`

      return json(
        {
          personnelId: existing.id,
          acceptUrl,
          expiresAt,
        },
        200,
      )
    }

    if (!body.companyRoleId) {
      return json({ error: 'companyRoleId is required.' }, 400)
    }
    if (!body.fullName?.trim()) {
      return json({ error: 'fullName is required.' }, 400)
    }

    let locationId = body.locationId
    if (!locationId) {
      const { data: defaultLocation, error: locationError } = await serviceClient
        .from('locations')
        .select('id')
        .eq('organization_id', body.organizationId)
        .order('created_at')
        .limit(1)
        .maybeSingle()

      if (locationError) {
        throw locationError
      }
      if (!defaultLocation) {
        return json({ error: 'No company location found for this organization.' }, 400)
      }
      locationId = defaultLocation.id
    }

    const { data: roleRow, error: roleError } = await serviceClient
      .from('company_roles')
      .select('id, organization_id')
      .eq('id', body.companyRoleId)
      .maybeSingle()

    if (roleError || !roleRow || roleRow.organization_id !== body.organizationId) {
      return json({ error: 'Invalid company role for this organization.' }, 400)
    }

    const { data: personnel, error: personnelError } = await serviceClient
      .from('personnel')
      .insert({
        organization_id: body.organizationId,
        location_id: locationId,
        full_name: body.fullName.trim(),
        title: body.title?.trim() || 'Personnel',
        status: 'invited',
        company_role_id: body.companyRoleId,
      })
      .select('id')
      .single()

    if (personnelError || !personnel) {
      throw personnelError ?? new Error('Failed to create personnel record.')
    }

    const token = createInviteToken()
    const tokenHash = await hashToken(token)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error: inviteError } = await serviceClient.from('personnel_invites').insert({
      organization_id: body.organizationId,
      personnel_id: personnel.id,
      email: email,
      token_hash: tokenHash,
      expires_at: expiresAt,
      invited_by: actor.id,
    })

    if (inviteError) {
      throw inviteError
    }

    await writeAuditLog(serviceClient, {
      organizationId: body.organizationId,
      actorUserId: actor.id,
      action: 'personnel.invited',
      entityTable: 'personnel',
      entityId: personnel.id,
      after: {
        email,
        companyRoleId: body.companyRoleId,
        mode: 'new_personnel',
      },
    })

    const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'
    const acceptUrl = `${siteUrl}/accept-invite?token=${encodeURIComponent(token)}`

    return json(
      {
        personnelId: personnel.id,
        acceptUrl,
        expiresAt,
      },
      200,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown invite error.'
    const status =
      message.includes('token') || message.includes('permission') || message.includes('member')
        ? 403
        : 400
    return json({ error: message }, status)
  }
})
