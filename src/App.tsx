import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Loader2 } from 'lucide-react'
import { ThemeProvider } from '@/components/theme-provider'
import { AppShell } from '@/components/layout/app-shell'
import { AuthGuard } from '@/components/layout/guards'
import { AuthInit, useAuth } from '@/hooks/use-auth'
import { LandingPage, PricingBlock } from '@/features/landing/landing-page'
import { LoginPage, RegisterPage, ForgotPage } from '@/features/auth/auth-pages'
import { OnboardingPage } from '@/features/onboarding/onboarding-page'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { AiSellerPage } from '@/features/ai-seller/ai-seller-page'
import { OrdersPage } from '@/features/orders/orders-page'
import { CustomersPage } from '@/features/crm/customers-page'
import { InventoryPage } from '@/features/inventory/inventory-page'
import { FinancePage } from '@/features/finance/finance-page'
import { InsightsPage } from '@/features/insights/insights-page'
import { IntegrationsPage } from '@/features/integrations/integrations-page'
import { VoicePage } from '@/features/voice/voice-page'
import { BillingPage } from '@/features/billing/billing-page'
import { ReferralsPage } from '@/features/referrals/referrals-page'
import { NotificationsPage } from '@/features/notifications/notifications-page'
import { SettingsPage } from '@/features/settings/settings-page'
import { AdminPage } from '@/features/admin/admin-page'
import { InvoiceCollectionsPage } from '@/features/invoice-collections/invoice-collections-page'

function AuthSplash() {
  const { loading } = useAuth()
  if (!loading) return null
  return (
    <div className="mesh grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>
      </div>
    </div>
  )
}

/** Renders routes only after the auth state listener has resolved once. */
function AuthedRoutes() {
  const { loading } = useAuth()
  return (
    <>
      <AuthSplash />
      {!loading && (
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPage />} />

          {/* Protected routes */}
          <Route
            path="/onboarding"
            element={
              <AuthGuard>
                <OnboardingPage />
              </AuthGuard>
            }
          />
          <Route
            path="/app/*"
            element={
              <AuthGuard>
                <AppShell>
                  <AppRoutes />
                </AppShell>
              </AuthGuard>
            }
          />

          {/* Admin routes */}
          <Route
            path="/admin/*"
            element={
              <AuthGuard requireAdmin>
                <AdminRoutes />
              </AuthGuard>
            }
          />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="savdopilot-theme">
      <AuthInit>
        <BrowserRouter>
          <AuthedRoutes />
          <Toaster position="top-right" />
        </BrowserRouter>
      </AuthInit>
    </ThemeProvider>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="ai" element={<AiSellerPage />} />
      <Route path="orders" element={<OrdersPage />} />
      <Route path="customers" element={<CustomersPage />} />
      <Route path="inventory" element={<InventoryPage />} />
      <Route path="finance" element={<FinancePage />} />
      <Route path="collections" element={<InvoiceCollectionsPage />} />
      <Route path="insights" element={<InsightsPage />} />
      <Route path="integrations" element={<IntegrationsPage />} />
      <Route path="voice" element={<VoicePage />} />
      <Route path="billing" element={<BillingPage />} />
      <Route path="referrals" element={<ReferralsPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="settings" element={<SettingsPage />} />
    </Routes>
  )
}

function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<AdminPage />} />
    </Routes>
  )
}

function PricingPage() {
  return (
    <div className="mesh min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <a href="/" className="font-display text-xl">
          AventryX AI
        </a>
        <div className="flex items-center gap-2">
          <a href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Kirish
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-display text-3xl">Tariflar</h1>
        <PricingBlock />
      </main>
      <footer className="border-t px-4 py-10 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:justify-between">
          <p>© {new Date().getFullYear()} AventryX AI</p>
          <div className="flex gap-4">
            <a href="/pricing">Tariflar</a>
            <a href="/login">Kirish</a>
            <a href="/register">Ro‘yxatdan o‘tish</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
