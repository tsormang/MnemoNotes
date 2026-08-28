import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { resolvePostLoginPath } from '../../lib/auth-routing'
import { isSupabaseConfigured } from '../../lib/supabase'
import { useAuth } from './AuthProvider'
import { useCan, useWorkspace } from './WorkspaceProvider'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (!isSupabaseConfigured) {
    return <Outlet />
  }

  if (loading) {
    return (
      <main className="auth-page">
        <p>Loading session…</p>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function RequirePlatformAdmin() {
  const { user, loading } = useAuth()
  const { isPlatformAdmin, loading: workspaceLoading } = useWorkspace()
  const location = useLocation()

  if (!isSupabaseConfigured) {
    return <Outlet />
  }

  if (loading || workspaceLoading) {
    return (
      <main className="auth-page">
        <p>Loading admin access…</p>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!isPlatformAdmin) {
    return <Navigate to="/app/calendar" replace />
  }

  return <Outlet />
}

export function RequirePeopleAccess({ children }: { children: ReactNode }) {
  const { isOwner } = useWorkspace()
  const canManagePersonnel = useCan('personnel.manage')
  const canManageRoles = useCan('roles.manage')

  if (!isOwner && !canManagePersonnel && !canManageRoles) {
    return <Navigate to="/app/calendar" replace />
  }

  return children
}

export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [redirectPath, setRedirectPath] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      return
    }

    void resolvePostLoginPath().then(setRedirectPath)
  }, [user])

  if (!isSupabaseConfigured) {
    return children
  }

  if (loading) {
    return (
      <main className="auth-page">
        <p>Loading…</p>
      </main>
    )
  }

  if (user && !redirectPath) {
    return (
      <main className="auth-page">
        <p>Loading…</p>
      </main>
    )
  }

  if (user && redirectPath) {
    return <Navigate to={redirectPath} replace />
  }

  return children
}
