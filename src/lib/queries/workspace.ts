import { useQuery, type QueryClient } from '@tanstack/react-query'
import { personnel as demoPersonnel, pharmacyLocations as demoLocations, calendarItems as demoCalendarItems } from '../../data/demo'
import { parseSeriesId } from '../calendar-series'
import { parseNotificationDefaults } from '../notification-schedule'
import { isSupabaseConfigured, supabase } from '../supabase'
import type {
  AppPermission,
  CalendarItem,
  CalendarItemKind,
  CompanyRole,
  Organization,
  Personnel,
  PersonnelInvite,
  PharmacyLocation,
} from '../../types/domain'

function formatTimeValue(value: string | null | undefined): string {
  if (!value) return '07:00'
  return value.slice(0, 5)
}

/** Org metadata and locations change rarely — keep warm across modal opens. */
export const WORKSPACE_STATIC_STALE_TIME = 5 * 60_000

export const workspaceQueryKeys = {
  organization: (organizationId: string | null) => ['organization', organizationId] as const,
  locations: (organizationId: string | null) => ['locations', organizationId] as const,
}

async function fetchOrganization(organizationId: string): Promise<Organization | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, timezone, working_day_start, working_day_end, settings, icon_id')
    .eq('id', organizationId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const settings = (data.settings ?? {}) as Record<string, unknown>

  return {
    id: data.id,
    name: data.name,
    timezone: data.timezone,
    workingDayStart: formatTimeValue(data.working_day_start),
    workingDayEnd: formatTimeValue(data.working_day_end),
    notificationDefaults: parseNotificationDefaults(settings.notificationDefaults),
    iconId: data.icon_id,
  }
}

async function fetchLocations(organizationId: string): Promise<PharmacyLocation[]> {
  if (!supabase) return demoLocations

  const { data, error } = await supabase
    .from('locations')
    .select('id, name, address, timezone, operating_hours')
    .eq('organization_id', organizationId)
    .order('created_at')

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address ?? '',
    timezone: row.timezone,
    openingHours:
      typeof row.operating_hours === 'object' &&
      row.operating_hours &&
      'label' in (row.operating_hours as Record<string, unknown>)
        ? String((row.operating_hours as Record<string, unknown>).label)
        : '07:00 - 21:00',
  }))
}

/** Warm org + location queries as soon as the workspace is known. */
export function prefetchWorkspaceBootstrap(
  queryClient: QueryClient,
  organizationId: string,
  seedOrganizationName?: string | null,
) {
  if (!isSupabaseConfigured) return

  if (seedOrganizationName) {
    queryClient.setQueryData<Organization | null>(
      workspaceQueryKeys.organization(organizationId),
      (current) =>
        current ??
        ({
          id: organizationId,
          name: seedOrganizationName,
          timezone: 'UTC',
          workingDayStart: '07:00',
          workingDayEnd: '21:00',
          notificationDefaults: parseNotificationDefaults(undefined),
          iconId: 'org-default',
        } satisfies Organization),
    )
  }

  void queryClient.prefetchQuery({
    queryKey: workspaceQueryKeys.organization(organizationId),
    queryFn: () => fetchOrganization(organizationId),
    staleTime: WORKSPACE_STATIC_STALE_TIME,
  })

  void queryClient.prefetchQuery({
    queryKey: workspaceQueryKeys.locations(organizationId),
    queryFn: () => fetchLocations(organizationId),
    staleTime: WORKSPACE_STATIC_STALE_TIME,
  })
}

export function useOrganization(organizationId: string | null) {
  return useQuery({
    queryKey: workspaceQueryKeys.organization(organizationId),
    queryFn: async (): Promise<Organization | null> => {
      if (!organizationId || !supabase) return null
      return fetchOrganization(organizationId)
    },
    enabled: Boolean(organizationId && isSupabaseConfigured),
    staleTime: WORKSPACE_STATIC_STALE_TIME,
  })
}

export function useLocations(organizationId: string | null) {
  return useQuery({
    queryKey: workspaceQueryKeys.locations(organizationId),
    queryFn: async (): Promise<PharmacyLocation[]> => {
      if (!organizationId || !supabase) return demoLocations
      return fetchLocations(organizationId)
    },
    enabled: Boolean(organizationId && isSupabaseConfigured),
    staleTime: WORKSPACE_STATIC_STALE_TIME,
  })
}

/** Primary org location + company name for readonly location fields. */
export function useCompanyLocation(
  organizationId: string | null,
  options?: { fallbackCompanyName?: string | null },
) {
  const orgQuery = useOrganization(organizationId)
  const locationsQuery = useLocations(organizationId)

  const demoFallback = isSupabaseConfigured ? null : demoLocations[0]
  const companyName =
    orgQuery.data?.name ??
    options?.fallbackCompanyName ??
    demoFallback?.name ??
    'Company'
  const locationId = locationsQuery.data?.[0]?.id ?? demoFallback?.id ?? ''
  const hasCompanyName = Boolean(
    orgQuery.data?.name ?? options?.fallbackCompanyName ?? demoFallback?.name,
  )

  return {
    companyName,
    locationId,
    /** True while the readonly company label has nothing to show yet. */
    companyNameLoading: !hasCompanyName && orgQuery.isLoading,
    /** True while the primary location id is still loading. */
    loading: locationsQuery.isLoading,
    ready: Boolean(locationId),
  }
}

export function useCompanyRoles(organizationId: string | null) {
  return useQuery({
    queryKey: ['company-roles', organizationId],
    queryFn: async (): Promise<CompanyRole[]> => {
      if (!organizationId || !supabase) return []

      const { data, error } = await supabase
        .from('company_roles')
        .select('id, organization_id, name, description, icon_id, company_role_permissions(permission)')
        .eq('organization_id', organizationId)
        .order('name')

      if (error) throw error

      return (data ?? []).map((row) => ({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        description: row.description,
        iconId: row.icon_id,
        permissions: (row.company_role_permissions ?? []).map(
          (entry) => entry.permission as AppPermission,
        ),
      }))
    },
    enabled: Boolean(organizationId && isSupabaseConfigured),
  })
}

export function usePersonnelList(organizationId: string | null) {
  return useQuery({
    queryKey: ['personnel', organizationId],
    queryFn: async (): Promise<Personnel[]> => {
      if (!organizationId || !supabase) return demoPersonnel

      const [personnelResult, invitesResult] = await Promise.all([
        supabase
          .from('personnel')
          .select(
            'id, full_name, title, status, skills, location_id, profile_id, company_role_id, icon_id, avatar_gender, company_roles(name)',
          )
          .eq('organization_id', organizationId)
          .order('full_name'),
        supabase
          .from('personnel_invites')
          .select('personnel_id, email, accepted_at')
          .eq('organization_id', organizationId)
          .is('accepted_at', null),
      ])

      if (personnelResult.error) throw personnelResult.error
      if (invitesResult.error) throw invitesResult.error

      const pendingEmails = new Map(
        (invitesResult.data ?? []).map((invite) => [invite.personnel_id, invite.email]),
      )

      return (personnelResult.data ?? []).map((row) => {
        const inviteEmail = pendingEmails.get(row.id) ?? null
        const accountLink: Personnel['accountLink'] = row.profile_id
          ? 'linked'
          : inviteEmail
            ? 'invited'
            : 'unlinked'

        return {
          id: row.id,
          fullName: row.full_name,
          companyRoleId: row.company_role_id ?? '',
          companyRoleName:
            row.company_roles && typeof row.company_roles === 'object' && 'name' in row.company_roles
              ? String(row.company_roles.name)
              : 'Unassigned',
          title: row.title,
          status: row.status === 'disabled' ? 'inactive' : (row.status as Personnel['status']),
          skills: row.skills ?? [],
          locationId: row.location_id ?? '',
          profileId: row.profile_id,
          inviteEmail,
          accountLink,
          iconId: row.icon_id,
          avatarGender: row.avatar_gender,
        }
      })
    },
    enabled: Boolean(organizationId && isSupabaseConfigured),
  })
}

export function usePersonnelInvites(organizationId: string | null) {
  return useQuery({
    queryKey: ['personnel-invites', organizationId],
    queryFn: async (): Promise<PersonnelInvite[]> => {
      if (!organizationId || !supabase) return []

      const { data, error } = await supabase
        .from('personnel_invites')
        .select('id, personnel_id, email, expires_at, accepted_at')
        .eq('organization_id', organizationId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data ?? []).map((row) => ({
        id: row.id,
        personnelId: row.personnel_id,
        email: row.email,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at,
      }))
    },
    enabled: Boolean(organizationId && isSupabaseConfigured),
  })
}

export function useCalendarItems(organizationId: string | null) {
  return useQuery({
    queryKey: ['calendar-items', organizationId],
    queryFn: async (): Promise<CalendarItem[]> => {
      if (!organizationId || !supabase) {
        return demoCalendarItems
      }

      const { data, error } = await supabase
        .from('calendar_items')
        .select(
          `
          id,
          kind,
          title,
          description,
          starts_at,
          ends_at,
          location_id,
          priority,
          requires_acknowledgement,
          metadata,
          shift_assignments(personnel_id)
        `,
        )
        .eq('organization_id', organizationId)
        .order('starts_at')

      if (error) throw error

      return (data ?? []).map((row) => {
        const metadata = (row.metadata ?? {}) as Record<string, unknown>
        return {
          id: row.id,
          kind: row.kind as CalendarItemKind,
          title: row.title,
          description: row.description ?? undefined,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          locationId: row.location_id ?? '',
          assignedPersonnelIds: (row.shift_assignments ?? []).map(
            (assignment) => assignment.personnel_id,
          ),
          priority: (row.priority as CalendarItem['priority']) ?? 'normal',
          noteCategory:
            typeof metadata.noteCategory === 'string' ? metadata.noteCategory : undefined,
          iconId: typeof metadata.iconId === 'string' ? metadata.iconId : undefined,
          seriesId: parseSeriesId(metadata),
          notificationOffsets: Array.isArray(metadata.notificationOffsets)
            ? metadata.notificationOffsets.map(Number)
            : [],
          requiresAcknowledgement: row.requires_acknowledgement,
        }
      })
    },
    enabled: Boolean(organizationId && isSupabaseConfigured),
  })
}

export function useOrganizationsAdminList(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-organizations'],
    queryFn: async () => {
      if (!supabase) return []

      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, timezone, status, created_at, updated_at')
        .order('name')

      if (error) throw error
      return data ?? []
    },
    enabled: enabled && isSupabaseConfigured,
  })
}

export interface AdminCompanyRow {
  id: string
  name: string
  timezone: string
  status: string
  createdAt: string
  updatedAt: string
  ownerName: string | null
  ownerEmail: string | null
  ownerStatus: 'active' | 'invited' | 'missing'
  inviteExpiresAt: string | null
}

async function fetchProfileNames(userIds: string[]): Promise<Map<string, string>> {
  if (!supabase || userIds.length === 0) return new Map()

  const uniqueIds = [...new Set(userIds)]
  const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', uniqueIds)

  if (error) throw error

  return new Map((data ?? []).map((row) => [row.id, row.full_name]))
}

export function useCompaniesAdminList(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-companies'],
    queryFn: async (): Promise<AdminCompanyRow[]> => {
      if (!supabase) return []

      const { data: organizations, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, timezone, status, created_at, updated_at')
        .order('name')

      if (orgError) throw orgError

      const { data: owners, error: ownerError } = await supabase
        .from('organization_members')
        .select('organization_id, status, user_id')
        .eq('role', 'owner')

      if (ownerError) throw ownerError

      const { data: pendingInvites, error: inviteError } = await supabase
        .from('organization_owner_invites')
        .select('organization_id, email, full_name, expires_at')
        .is('accepted_at', null)

      if (inviteError) throw inviteError

      const profileNames = await fetchProfileNames((owners ?? []).map((row) => row.user_id))

      return (organizations ?? []).map((org) => {
        const ownerMember = (owners ?? []).find((row) => row.organization_id === org.id)
        const pendingInvite = (pendingInvites ?? []).find((row) => row.organization_id === org.id)
        const profileName = ownerMember ? (profileNames.get(ownerMember.user_id) ?? null) : null

        let ownerStatus: AdminCompanyRow['ownerStatus'] = 'missing'
        if (ownerMember?.status === 'active') {
          ownerStatus = 'active'
        } else if (pendingInvite || ownerMember?.status === 'invited') {
          ownerStatus = 'invited'
        }

        return {
          id: org.id,
          name: org.name,
          timezone: org.timezone,
          status: org.status,
          createdAt: org.created_at,
          updatedAt: org.updated_at,
          ownerName: profileName ?? pendingInvite?.full_name ?? null,
          ownerEmail: pendingInvite?.email ?? null,
          ownerStatus,
          inviteExpiresAt: pendingInvite?.expires_at ?? null,
        }
      })
    },
    enabled: enabled && isSupabaseConfigured,
  })
}

export function useAuditLogAdminList(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-audit-log'],
    queryFn: async () => {
      if (!supabase) return []

      const { data, error } = await supabase
        .from('audit_log')
        .select('id, organization_id, actor_user_id, action, entity_table, entity_id, created_at')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      return data ?? []
    },
    enabled: enabled && isSupabaseConfigured,
  })
}

export function useOrganizationMembersAdminList(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-organization-members'],
    queryFn: async () => {
      if (!supabase) return []

      const { data: members, error } = await supabase
        .from('organization_members')
        .select('id, organization_id, user_id, role, status, updated_at, organizations(name)')
        .order('updated_at', { ascending: false })

      if (error) throw error

      const profileNames = await fetchProfileNames((members ?? []).map((row) => row.user_id))

      return (members ?? []).map((member) => ({
        ...member,
        profiles: profileNames.has(member.user_id) ? { full_name: profileNames.get(member.user_id)! } : null,
      }))
    },
    enabled: enabled && isSupabaseConfigured,
  })
}

export function useWeekOverrides(organizationId: string | null) {
  return useQuery({
    queryKey: ['week-overrides', organizationId],
    queryFn: async (): Promise<Record<string, boolean>> => {
      if (!organizationId || !supabase) return {}

      const { data, error } = await supabase
        .from('calendar_week_overrides')
        .select('week_start_date, show_all_hours')
        .eq('organization_id', organizationId)

      if (error) throw error

      return Object.fromEntries(
        (data ?? [])
          .filter((row) => row.show_all_hours)
          .map((row) => [row.week_start_date, true]),
      )
    },
    enabled: Boolean(organizationId && isSupabaseConfigured),
  })
}
