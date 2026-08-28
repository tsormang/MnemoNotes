import type { AppPermission } from '../types/domain'
import { isSupabaseConfigured, supabase } from './supabase'

export async function invokeEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  options?: { requireAuth?: boolean },
): Promise<T> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }

  const requireAuth = options?.requireAuth ?? true
  let headers: Record<string, string> | undefined

  if (requireAuth) {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error('You must be signed in.')
    }

    headers = { Authorization: `Bearer ${session.access_token}` }
  }

  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers,
  })

  if (error) {
    const message = error.message ?? 'Edge Function request failed.'
    if (message.includes('Failed to send a request to the Edge Function')) {
      throw new Error(
        `Edge Function "${functionName}" is not reachable. Deploy functions to your Supabase project (npm run functions:deploy) or run "supabase functions serve" for local dev.`,
      )
    }
    throw error
  }

  if (data?.error) {
    throw new Error(String(data.error))
  }

  return data as T
}

export function resolveMemberPermissions(input: {
  systemRole: 'owner' | 'personnel' | 'manager' | 'viewer' | 'developer_admin' | null
  companyRolePermissions: AppPermission[]
  ownerPermissions: AppPermission[]
}): AppPermission[] {
  if (input.systemRole === 'owner') {
    return input.ownerPermissions
  }

  return input.companyRolePermissions
}
