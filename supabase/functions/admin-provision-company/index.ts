import { writeAuditLog, writePlatformAction } from '../_shared/audit.ts'
import { getEnvClients, requirePlatformAdmin } from '../_shared/clients.ts'
import { defaultCompanyRoles } from '../_shared/default-roles.ts'
import { corsHeaders, json } from '../_shared/http.ts'
import { createInviteToken, hashToken } from '../_shared/tokens.ts'

interface ProvisionCompanyRequest {
  organizationName: string
  timezone?: string
  ownerName: string
  ownerEmail: string
  ownerPassword?: string
  locationName?: string
}

function buildAcceptUrl(token: string) {
  const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'
  return `${siteUrl}/accept-invite?token=${encodeURIComponent(token)}`
}

async function seedCompanyRoles(
  serviceClient: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2').createClient>,
  organizationId: string,
) {
  const roleIds: Record<string, string> = {}

  for (const role of defaultCompanyRoles) {
    const { data: roleRow, error: roleError } = await serviceClient
      .from('company_roles')
      .insert({
        organization_id: organizationId,
        name: role.name,
        description: role.description,
        icon: role.icon,
        is_system: true,
      })
      .select('id')
      .single()

    if (roleError || !roleRow) {
      throw roleError ?? new Error(`Failed to seed role ${role.name}.`)
    }

    roleIds[role.name] = roleRow.id

    if (role.permissions.length > 0) {
      const { error: permError } = await serviceClient.from('company_role_permissions').insert(
        role.permissions.map((permission) => ({
          company_role_id: roleRow.id,
          permission,
        })),
      )

      if (permError) {
        throw permError
      }
    }
  }

  return roleIds
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { serviceClient, userClient } = getEnvClients(request)
    const actor = await requirePlatformAdmin(serviceClient, userClient)
    const body = (await request.json()) as ProvisionCompanyRequest

    if (!body.organizationName?.trim()) {
      return json({ error: 'organizationName is required.' }, 400)
    }
    if (!body.ownerName?.trim()) {
      return json({ error: 'ownerName is required.' }, 400)
    }
    if (!body.ownerEmail?.trim()) {
      return json({ error: 'ownerEmail is required.' }, 400)
    }

    const ownerPassword = body.ownerPassword?.trim()
    const useDirectPassword = Boolean(ownerPassword && ownerPassword.length >= 10)

    if (ownerPassword && !useDirectPassword) {
      return json({ error: 'ownerPassword must be at least 10 characters when provided.' }, 400)
    }

    const timezone = body.timezone?.trim() || 'Europe/Athens'
    const locationName = body.locationName?.trim() || 'Main location'
    const ownerEmail = body.ownerEmail.trim().toLowerCase()
    const ownerName = body.ownerName.trim()

    const { data: organization, error: orgError } = await serviceClient
      .from('organizations')
      .insert({
        name: body.organizationName.trim(),
        timezone,
        created_by: actor.id,
      })
      .select('id, name')
      .single()

    if (orgError || !organization) {
      throw orgError ?? new Error('Failed to create organization.')
    }

    const { error: profileError } = await serviceClient.from('pharmacy_profiles').insert({
      organization_id: organization.id,
    })

    if (profileError) {
      throw profileError
    }

    const { data: location, error: locationError } = await serviceClient
      .from('locations')
      .insert({
        organization_id: organization.id,
        name: locationName,
        timezone,
      })
      .select('id')
      .single()

    if (locationError || !location) {
      throw locationError ?? new Error('Failed to create default location.')
    }

    await seedCompanyRoles(serviceClient, organization.id)

    if (useDirectPassword && ownerPassword) {
      const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true,
        user_metadata: { full_name: ownerName },
      })

      if (authError || !authUser.user) {
        throw authError ?? new Error('Failed to create owner auth user.')
      }

      await serviceClient
        .from('profiles')
        .update({ full_name: ownerName, timezone })
        .eq('id', authUser.user.id)

      const { error: memberError } = await serviceClient.from('organization_members').insert({
        organization_id: organization.id,
        user_id: authUser.user.id,
        role: 'owner',
        status: 'active',
        invited_by: actor.id,
      })

      if (memberError) {
        throw memberError
      }

      await writeAuditLog(serviceClient, {
        organizationId: organization.id,
        actorUserId: actor.id,
        action: 'company.provisioned',
        entityTable: 'organizations',
        entityId: organization.id,
        after: {
          name: organization.name,
          ownerEmail,
          locationId: location.id,
          mode: 'direct_password',
        },
      })

      await writePlatformAction(serviceClient, {
        actorUserId: actor.id,
        action: 'provision_company',
        targetTable: 'organizations',
        targetId: organization.id,
        metadata: { ownerUserId: authUser.user.id, mode: 'direct_password' },
      })

      return json(
        {
          organizationId: organization.id,
          organizationName: organization.name,
          ownerUserId: authUser.user.id,
          defaultLocationId: location.id,
          mode: 'direct_password',
        },
        200,
      )
    }

    const token = createInviteToken()
    const tokenHash = await hashToken(token)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error: inviteError } = await serviceClient.from('organization_owner_invites').insert({
      organization_id: organization.id,
      email: ownerEmail,
      full_name: ownerName,
      token_hash: tokenHash,
      expires_at: expiresAt,
      invited_by: actor.id,
    })

    if (inviteError) {
      throw inviteError
    }

    await writeAuditLog(serviceClient, {
      organizationId: organization.id,
      actorUserId: actor.id,
      action: 'company.provisioned',
      entityTable: 'organizations',
      entityId: organization.id,
      after: {
        name: organization.name,
        ownerEmail,
        locationId: location.id,
        mode: 'owner_invite',
      },
    })

    await writePlatformAction(serviceClient, {
      actorUserId: actor.id,
      action: 'provision_company',
      targetTable: 'organizations',
      targetId: organization.id,
      metadata: { ownerEmail, mode: 'owner_invite' },
    })

    return json(
      {
        organizationId: organization.id,
        organizationName: organization.name,
        defaultLocationId: location.id,
        mode: 'owner_invite',
        acceptUrl: buildAcceptUrl(token),
        expiresAt,
      },
      200,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown provisioning error.'
    const status = message.includes('token') || message.includes('admin') ? 403 : 400
    return json({ error: message }, status)
  }
})
