import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '@/hooks/use-session'
import { AppShell } from '@/components/layout/app-shell'
import { readSelectedProduct, type ProductType } from '@/lib/product-context'
import type { ReactNode } from 'react'

/** Post-auth destination based on the chosen product direction. */
export function productDestination(p: ProductType | null): string {
  return p === 'invoices' ? '/app/collections' : '/app'
}

/**
 * Where a freshly authenticated user should land, given the profile's stamped
 * product (or the localStorage pick when the profile has none yet).
 */
export function resolvePostAuthPath(
  productType: ProductType | null | undefined,
): string {
  const product = productType ?? readSelectedProduct()
  // No direction chosen yet → the service-type chooser decides what's next.
  return product ? productDestination(product) : '/choose-service'
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
    pathname !== '/onboarding' &&
    pathname !== '/choose-service'
  ) {
    if (profile.productType === 'invoices') {
      // Invoices users skipped the sales wizard — any /app page is fine for them.
      if (!pathname.startsWith('/app')) return <Navigate to="/app/collections" replace />
    } else if (!profile.productType) {
      return <Navigate to="/choose-service" replace />
    } else {
      return <Navigate to="/onboarding" replace />
    }
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
  const { profile, business } = useSession()
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role !== 'admin') return <Navigate to="/app" replace />
  if (business && !business.onboardingComplete) return <Navigate to="/onboarding" replace />
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
      return (
        <Navigate
          to={
            profile.productType === 'invoices'
              ? '/app/collections'
              : profile.productType
                ? '/onboarding'
                : '/choose-service'
          }
          replace
        />
      )
    }
    return <Navigate to={productDestination(readSelectedProduct())} replace />
  }
  return <Outlet />
}
