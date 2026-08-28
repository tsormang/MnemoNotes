import { isSupabaseConfigured, supabase } from './supabase'

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
