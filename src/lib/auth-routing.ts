import { isSupabaseConfigured, supabase } from './supabase'

export function authRedirectUrl(path: string): string {
  if (typeof window === 'undefined') {
    return path
  }

  return `${window.location.origin}${path}`
}

export async function resolvePostLoginPath(): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    return '/app/calendar'
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return '/login'
  }

  const { data: platformAdmin } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  return platformAdmin ? '/admin' : '/app/calendar'
}
