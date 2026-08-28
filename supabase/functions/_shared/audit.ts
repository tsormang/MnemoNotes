import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function writeAuditLog(
  serviceClient: SupabaseClient,
  entry: {
    organizationId?: string | null
    actorUserId?: string | null
    action: string
    entityTable: string
    entityId?: string | null
    before?: unknown
    after?: unknown
  },
) {
  await serviceClient.from('audit_log').insert({
    organization_id: entry.organizationId ?? null,
    actor_user_id: entry.actorUserId ?? null,
    action: entry.action,
    entity_table: entry.entityTable,
    entity_id: entry.entityId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  })
}

export async function writePlatformAction(
  serviceClient: SupabaseClient,
  entry: {
    actorUserId: string
    action: string
    targetTable?: string | null
    targetId?: string | null
    reason?: string | null
    metadata?: Record<string, unknown>
  },
) {
  await serviceClient.from('platform_admin_actions').insert({
    actor_user_id: entry.actorUserId,
    action: entry.action,
    target_table: entry.targetTable ?? null,
    target_id: entry.targetId ?? null,
    reason: entry.reason ?? null,
    metadata: entry.metadata ?? {},
  })
}
