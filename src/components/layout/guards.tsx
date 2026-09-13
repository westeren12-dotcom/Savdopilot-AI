import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '@/hooks/use-session'
import { AppShell } from '@/components/layout/app-shell'
import { readSelectedProduct, type ProductType } from '@/lib/product-context'
import type { ReactNode } from 'react'

/** Post-auth destination based on the chosen product direction. */
export function productDestination(p: ProductType | null): string {
  return p === 'invoices' ? '/app/collections' : '/app'
}

export function AuthGuard({ requireAdmin = false, children }: { requireAdmin?: boolean; children?: ReactNode }) {
  const { profile, business } = useSession()
  const { pathname } = useLocation()
  if (!profile) return <Navigate to="/login" replace />
  if (requireAdmin && profile.role !== 'admin') return <Navigate to="/app" replace />
  // Redirect to onboarding only when we are not already there — otherwise the
  // guard would loop forever on /onboarding and the page would never render.
  if (
    !requireAdmin &&
    profile.role !== 'admin' &&
    business &&
    !business.onboardingComplete &&
    pathname !== '/onboarding'
  ) {
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
    return <Navigate to={productDestination(readSelectedProduct())} replace />
  }
  return <Outlet />
}
