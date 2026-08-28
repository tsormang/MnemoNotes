import { useQuery } from '@tanstack/react-query'
import { isSupabaseConfigured, supabase } from '../supabase'
import type { AuditLogEntry } from '../../types/domain'

type AuditLogRow = {
  id: string
  organization_id: string | null
  actor_user_id: string | null
  action: string
  entity_table: string
  entity_id: string | null
  before: unknown
  after: unknown
  created_at: string
}

export function useAuditLog(organizationId: string | null) {
  return useQuery({
    queryKey: ['audit-log', organizationId],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      if (!organizationId || !supabase) return []

      const { data, error } = await supabase
        .from('audit_log')
        .select(
          'id, organization_id, actor_user_id, action, entity_table, entity_id, before, after, created_at',
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      const rows = (data ?? []) as AuditLogRow[]
      const actorIds = [
        ...new Set(rows.map((row) => row.actor_user_id).filter((id): id is string => Boolean(id))),
      ]

      const actorNames = new Map<string, string>()
      if (actorIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', actorIds)

        if (profileError) throw profileError

        for (const profile of profiles ?? []) {
          actorNames.set(profile.id, profile.full_name?.trim() || 'Unknown user')
        }
      }

      return rows.map((row) => ({
        id: row.id,
        organizationId: row.organization_id,
        actorUserId: row.actor_user_id,
        actorName: row.actor_user_id
          ? (actorNames.get(row.actor_user_id) ?? 'Unknown user')
          : 'System',
        action: row.action,
        entityTable: row.entity_table,
        entityId: row.entity_id,
        before: row.before,
        after: row.after,
        createdAt: row.created_at,
      }))
    },
    enabled: Boolean(organizationId && isSupabaseConfigured),
  })
}
