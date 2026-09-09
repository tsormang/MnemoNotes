import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { writeAuditLog, writePlatformAction } from '../_shared/audit.ts'
import { getEnvClients, requirePlatformAdmin } from '../_shared/clients.ts'
import { corsHeaders, json } from '../_shared/http.ts'
import { attachActiveOwner, createCompanyWorkspace } from '../_shared/provision-company.ts'

interface ReviewRegistrationBody {
  action?: 'update' | 'approve' | 'reject' | 'resend'
  requestId?: string
  companyName?: string
  fullName?: string
  timezone?: string
  reviewNote?: string
}

function siteUrl() {
  return Deno.env.get('SITE_URL') ?? 'http://localhost:5173'
}

function trimOrUndefined(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

async function loadRequest(
  serviceClient: ReturnType<typeof getEnvClients>['serviceClient'],
  requestId: string,
) {
  const { data, error } = await serviceClient
    .from('organization_registration_requests')
    .select(
      'id, email, full_name, company_name, timezone, auth_user_id, status, organization_id, review_note',
    )
    .eq('id', requestId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Registration request not found.')
  return data
}

async function generateActionLink(
  serviceClient: ReturnType<typeof getEnvClients>['serviceClient'],
  email: string,
) {
  const { data, error } = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${siteUrl()}/app/calendar` },
  })

  if (error) {
    return null
  }

  return data.properties?.action_link ?? null
}

async function sendApprovalEmail(email: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return false

  const anonClient = createClient(supabaseUrl, anonKey)
  const { error } = await anonClient.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${siteUrl()}/app/calendar`,
    },
  })

  return !error
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { serviceClient, userClient } = getEnvClients(request)
    const actor = await requirePlatformAdmin(serviceClient, userClient)
    const body = (await request.json()) as ReviewRegistrationBody
    const action = body.action
    const requestId = body.requestId?.trim()

    if (!action || !['update', 'approve', 'reject', 'resend'].includes(action)) {
      return json({ error: 'action must be update, approve, reject, or resend.' }, 400)
    }
    if (!requestId) {
      return json({ error: 'requestId is required.' }, 400)
    }

    const registration = await loadRequest(serviceClient, requestId)

    if (action === 'update') {
      if (registration.status !== 'pending') {
        return json({ error: 'Only pending requests can be edited.' }, 400)
      }

      const companyName = trimOrUndefined(body.companyName) ?? registration.company_name
      const fullName = trimOrUndefined(body.fullName) ?? registration.full_name
      const timezone = trimOrUndefined(body.timezone) ?? registration.timezone
      const reviewNote = body.reviewNote === undefined ? registration.review_note : body.reviewNote.trim() || null

      if (companyName.length < 2) {
        return json({ error: 'Company name is required.' }, 400)
      }
      if (fullName.length < 2) {
        return json({ error: 'Full name is required.' }, 400)
      }

      const { error: updateError } = await serviceClient
        .from('organization_registration_requests')
        .update({
          company_name: companyName,
          full_name: fullName,
          timezone,
          review_note: reviewNote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', registration.id)

      if (updateError) throw updateError

      await writePlatformAction(serviceClient, {
        actorUserId: actor.id,
        action: 'registration.update',
        targetTable: 'organization_registration_requests',
        targetId: registration.id,
        metadata: { companyName, fullName, timezone },
      })

      return json({ ok: true, requestId: registration.id })
    }

    if (action === 'reject') {
      if (registration.status !== 'pending') {
        return json({ error: 'Only pending requests can be rejected.' }, 400)
      }

      const reviewNote = body.reviewNote === undefined ? registration.review_note : body.reviewNote.trim() || null

      const { error: rejectError } = await serviceClient
        .from('organization_registration_requests')
        .update({
          status: 'rejected',
          reviewed_by: actor.id,
          reviewed_at: new Date().toISOString(),
          review_note: reviewNote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', registration.id)

      if (rejectError) throw rejectError

      if (registration.auth_user_id) {
        await serviceClient.auth.admin.deleteUser(registration.auth_user_id)
      }

      await writePlatformAction(serviceClient, {
        actorUserId: actor.id,
        action: 'registration.reject',
        targetTable: 'organization_registration_requests',
        targetId: registration.id,
        reason: reviewNote,
        metadata: { email: registration.email },
      })

      return json({ ok: true, requestId: registration.id, status: 'rejected' })
    }

    if (action === 'resend') {
      if (registration.status !== 'approved') {
        return json({ error: 'Only approved requests can resend a sign-in email.' }, 400)
      }

      const emailSent = await sendApprovalEmail(registration.email)
      const actionLink = await generateActionLink(serviceClient, registration.email)

      await writePlatformAction(serviceClient, {
        actorUserId: actor.id,
        action: 'registration.resend',
        targetTable: 'organization_registration_requests',
        targetId: registration.id,
        metadata: { email: registration.email, emailSent },
      })

      return json({
        ok: true,
        requestId: registration.id,
        emailSent,
        actionLink,
      })
    }

    if (registration.status !== 'pending') {
      return json({ error: 'Only pending requests can be approved.' }, 400)
    }
    if (!registration.auth_user_id) {
      return json({ error: 'Registration is missing an auth user.' }, 400)
    }

    const companyName = trimOrUndefined(body.companyName) ?? registration.company_name
    const fullName = trimOrUndefined(body.fullName) ?? registration.full_name
    const timezone = trimOrUndefined(body.timezone) ?? registration.timezone
    const reviewNote = body.reviewNote === undefined ? registration.review_note : body.reviewNote.trim() || null

    if (companyName.length < 2) {
      return json({ error: 'Company name is required.' }, 400)
    }

    const { organization, location } = await createCompanyWorkspace(serviceClient, {
      organizationName: companyName,
      timezone,
      locationName: companyName,
      createdBy: actor.id,
    })

    try {
      await attachActiveOwner(serviceClient, {
        organizationId: organization.id,
        userId: registration.auth_user_id,
        invitedBy: actor.id,
      })

      await serviceClient
        .from('profiles')
        .update({ full_name: fullName, timezone })
        .eq('id', registration.auth_user_id)

      const { error: confirmError } = await serviceClient.auth.admin.updateUserById(registration.auth_user_id, {
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })

      if (confirmError) throw confirmError

      const { error: approveError } = await serviceClient
        .from('organization_registration_requests')
        .update({
          company_name: companyName,
          full_name: fullName,
          timezone,
          status: 'approved',
          organization_id: organization.id,
          reviewed_by: actor.id,
          reviewed_at: new Date().toISOString(),
          review_note: reviewNote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', registration.id)

      if (approveError) throw approveError
    } catch (approveFailure) {
      await serviceClient.from('organizations').delete().eq('id', organization.id)
      throw approveFailure
    }

    await writeAuditLog(serviceClient, {
      organizationId: organization.id,
      actorUserId: actor.id,
      action: 'company.provisioned',
      entityTable: 'organizations',
      entityId: organization.id,
      after: {
        name: organization.name,
        ownerEmail: registration.email,
        locationId: location.id,
        mode: 'registration_approval',
        requestId: registration.id,
      },
    })

    await writePlatformAction(serviceClient, {
      actorUserId: actor.id,
      action: 'registration.approve',
      targetTable: 'organization_registration_requests',
      targetId: registration.id,
      metadata: {
        organizationId: organization.id,
        ownerUserId: registration.auth_user_id,
        email: registration.email,
      },
    })

    const emailSent = await sendApprovalEmail(registration.email)
    const actionLink = await generateActionLink(serviceClient, registration.email)

    return json({
      ok: true,
      requestId: registration.id,
      organizationId: organization.id,
      organizationName: organization.name,
      emailSent,
      actionLink,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown review error.'
    const status = message.includes('token') || message.includes('admin') ? 403 : 400
    return json({ error: message }, status)
  }
})
