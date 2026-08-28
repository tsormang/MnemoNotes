import { writeAuditLog, writePlatformAction } from '../_shared/audit.ts'
import { getEnvClients, requirePlatformAdmin } from '../_shared/clients.ts'
import { corsHeaders, json } from '../_shared/http.ts'
import { createInviteToken, hashToken } from '../_shared/tokens.ts'

interface InviteOwnerRequest {
  organizationId: string
  ownerName?: string
  ownerEmail?: string
}

function buildAcceptUrl(token: string) {
  const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'
  return `${siteUrl}/accept-invite?token=${encodeURIComponent(token)}`
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { serviceClient, userClient } = getEnvClients(request)
    const actor = await requirePlatformAdmin(serviceClient, userClient)
    const body = (await request.json()) as InviteOwnerRequest

    if (!body.organizationId) {
      return json({ error: 'organizationId is required.' }, 400)
    }

    const { data: organization, error: orgError } = await serviceClient
      .from('organizations')
      .select('id, name')
      .eq('id', body.organizationId)
      .maybeSingle()

    if (orgError || !organization) {
      return json({ error: 'Organization not found.' }, 404)
    }

    const { data: activeOwner, error: ownerError } = await serviceClient
      .from('organization_members')
      .select('id')
      .eq('organization_id', body.organizationId)
      .eq('role', 'owner')
      .eq('status', 'active')
      .maybeSingle()

    if (ownerError) {
      throw ownerError
    }

    if (activeOwner) {
      return json({ error: 'This organization already has an active owner.' }, 400)
    }

    const { data: pendingInvite, error: pendingError } = await serviceClient
      .from('organization_owner_invites')
      .select('id, email, full_name')
      .eq('organization_id', body.organizationId)
      .is('accepted_at', null)
      .maybeSingle()

    if (pendingError) {
      throw pendingError
    }

    const ownerName = body.ownerName?.trim() || pendingInvite?.full_name
    const ownerEmail = body.ownerEmail?.trim().toLowerCase() || pendingInvite?.email

    if (!ownerName) {
      return json({ error: 'ownerName is required.' }, 400)
    }
    if (!ownerEmail) {
      return json({ error: 'ownerEmail is required.' }, 400)
    }

    const token = createInviteToken()
    const tokenHash = await hashToken(token)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    if (pendingInvite) {
      const { error: updateError } = await serviceClient
        .from('organization_owner_invites')
        .update({
          email: ownerEmail,
          full_name: ownerName,
          token_hash: tokenHash,
          expires_at: expiresAt,
          invited_by: actor.id,
        })
        .eq('id', pendingInvite.id)

      if (updateError) {
        throw updateError
      }
    } else {
      const { error: insertError } = await serviceClient.from('organization_owner_invites').insert({
        organization_id: body.organizationId,
        email: ownerEmail,
        full_name: ownerName,
        token_hash: tokenHash,
        expires_at: expiresAt,
        invited_by: actor.id,
      })

      if (insertError) {
        throw insertError
      }
    }

    await writeAuditLog(serviceClient, {
      organizationId: body.organizationId,
      actorUserId: actor.id,
      action: 'owner.invited',
      entityTable: 'organization_owner_invites',
      entityId: body.organizationId,
      after: { email: ownerEmail, fullName: ownerName },
    })

    await writePlatformAction(serviceClient, {
      actorUserId: actor.id,
      action: 'invite_owner',
      targetTable: 'organizations',
      targetId: body.organizationId,
      metadata: { ownerEmail },
    })

    return json(
      {
        organizationId: body.organizationId,
        organizationName: organization.name,
        acceptUrl: buildAcceptUrl(token),
        expiresAt,
      },
      200,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown owner invite error.'
    const status = message.includes('token') || message.includes('admin') ? 403 : 400
    return json({ error: message }, status)
  }
})
