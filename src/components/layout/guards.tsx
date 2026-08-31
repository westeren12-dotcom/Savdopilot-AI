import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from '@/hooks/use-session'
import { AppShell } from '@/components/layout/app-shell'
import type { ReactNode } from 'react'

export function AuthGuard({ requireAdmin = false, children }: { requireAdmin?: boolean; children?: ReactNode }) {
  const { profile, business } = useSession()
  if (!profile) return <Navigate to="/login" replace />
  if (requireAdmin && profile.role !== 'admin') return <Navigate to="/app" replace />
  if (!requireAdmin && profile.role !== 'admin' && business && !business.onboardingComplete) {
    return <Navigate to="/onboarding" replace />
  }
  return <>{children || <Outlet />}</>
}

export function RequireAuth() {
  const { profile } = useSession()
  if (!profile) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RequireOnboardingDone() {
  const { profile, business } = useSession()
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role !== 'admin' && business && !business.onboardingComplete) {
    return <Navigate to="/onboarding" replace />
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export function RequireAdmin() {
  const { profile } = useSession()
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role !== 'admin') return <Navigate to="/app" replace />
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export function GuestOnly() {
  const { profile, business } = useSession()
  if (profile) {
    if (profile.role !== 'admin' && business && !business.onboardingComplete) {
      return <Navigate to="/onboarding" replace />
    }
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/app'} replace />
  }
  return <Outlet />
}
