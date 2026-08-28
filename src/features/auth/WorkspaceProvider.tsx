import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type PropsWithChildren,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { rolePermissions } from '../../lib/access-control'
import { prefetchWorkspaceBootstrap } from '../../lib/queries/workspace'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import type { AppPermission, AppRole, WorkspaceMembership } from '../../types/domain'
import { useAuth } from './AuthProvider'

interface WorkspaceContextValue {
  loading: boolean
  membership: WorkspaceMembership | null
  organizationId: string | null
  can: (permission: AppPermission) => boolean
  isPlatformAdmin: boolean
  isOwner: boolean
  refresh: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

async function loadWorkspace(userId: string): Promise<WorkspaceMembership | null> {
  if (!supabase) return null

  const { data: platformAdmin } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (platformAdmin) {
    return {
      organizationId: '',
      organizationName: 'Platform',
      workspaceLabel: 'Platform',
      systemRole: 'developer_admin',
      personnelId: null,
      companyRoleId: null,
      permissions: rolePermissions.developer_admin,
    }
  }

  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .select('organization_id, role, organizations(name)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (memberError || !member) {
    return null
  }

  const organizationName =
    member.organizations && typeof member.organizations === 'object' && 'name' in member.organizations
      ? String(member.organizations.name)
      : 'Workspace'

  if (member.role === 'owner') {
    return {
      organizationId: member.organization_id,
      organizationName,
      workspaceLabel: organizationName,
      systemRole: 'owner',
      personnelId: null,
      companyRoleId: null,
      permissions: rolePermissions.owner,
    }
  }

  const { data: personnel, error: personnelError } = await supabase
    .from('personnel')
    .select('id, company_role_id, company_roles(name, company_role_permissions(permission))')
    .eq('organization_id', member.organization_id)
    .eq('profile_id', userId)
    .maybeSingle()

  if (personnelError || !personnel) {
    return {
      organizationId: member.organization_id,
      organizationName,
      workspaceLabel: organizationName,
      systemRole: member.role as AppRole,
      personnelId: null,
      companyRoleId: null,
      permissions: [],
    }
  }

  const companyRole = personnel.company_roles
  const permissions =
    companyRole &&
    typeof companyRole === 'object' &&
    'company_role_permissions' in companyRole &&
    Array.isArray(companyRole.company_role_permissions)
      ? companyRole.company_role_permissions.map((row) => row.permission as AppPermission)
      : []

  const companyRoleName =
    companyRole && typeof companyRole === 'object' && 'name' in companyRole
      ? String(companyRole.name)
      : 'Staff'

  return {
    organizationId: member.organization_id,
    organizationName,
    workspaceLabel: `${organizationName} · ${companyRoleName}`,
    systemRole: member.role as AppRole,
    personnelId: personnel.id,
    companyRoleId: personnel.company_role_id,
    permissions,
  }
}

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['workspace', user?.id],
    queryFn: async () => {
      if (!user) return null
      return loadWorkspace(user.id)
    },
    enabled: Boolean(user && isSupabaseConfigured),
  })

  const membership = query.data ?? null
  const loading = authLoading || (Boolean(user) && query.isLoading)

  useEffect(() => {
    if (!membership?.organizationId) return
    prefetchWorkspaceBootstrap(
      queryClient,
      membership.organizationId,
      membership.organizationName,
    )
  }, [membership?.organizationId, membership?.organizationName, queryClient])

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      loading,
      membership,
      organizationId: membership?.organizationId || null,
      can: (permission) => Boolean(membership?.permissions.includes(permission)),
      isPlatformAdmin: membership?.systemRole === 'developer_admin',
      isOwner: membership?.systemRole === 'owner',
      refresh: () => {
        void query.refetch()
      },
    }),
    [loading, membership, query],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider.')
  }
  return context
}

export function useCan(permission: AppPermission) {
  const { can } = useWorkspace()
  return can(permission)
}
