import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function createCompanyWorkspace(
  serviceClient: SupabaseClient,
  input: {
    organizationName: string
    timezone: string
    locationName?: string
    createdBy?: string | null
  },
) {
  const { data: organization, error: orgError } = await serviceClient
    .from('organizations')
    .insert({
      name: input.organizationName,
      timezone: input.timezone,
      created_by: input.createdBy ?? null,
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

  const locationName = input.locationName?.trim() || input.organizationName
  const { data: location, error: locationError } = await serviceClient
    .from('locations')
    .insert({
      organization_id: organization.id,
      name: locationName,
      timezone: input.timezone,
    })
    .select('id')
    .single()

  if (locationError || !location) {
    throw locationError ?? new Error('Failed to create default location.')
  }

  return { organization, location }
}

export async function attachActiveOwner(
  serviceClient: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    invitedBy?: string | null
  },
) {
  const { error } = await serviceClient.from('organization_members').insert({
    organization_id: input.organizationId,
    user_id: input.userId,
    role: 'owner',
    status: 'active',
    invited_by: input.invitedBy ?? null,
  })

  if (error) {
    throw error
  }
}
