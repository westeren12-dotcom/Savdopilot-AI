import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  Bot,
  Boxes,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  Sun,
  Users,
  Wallet,
  Share2,
  Plug,
  Mic,
} from 'lucide-react'
import { useSession } from '@/hooks/use-session'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

const nav = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/ai', label: 'AI-Sotuvchi', icon: Bot },
  { to: '/app/orders', label: 'Buyurtmalar', icon: ShoppingBag },
  { to: '/app/customers', label: 'CRM', icon: Users },
  { to: '/app/inventory', label: 'Ombor', icon: Boxes },
  { to: '/app/finance', label: 'Moliya', icon: Wallet },
  { to: '/app/insights', label: 'AI Insights', icon: Sparkles },
  { to: '/app/integrations', label: 'Integratsiyalar', icon: Plug },
  { to: '/app/voice', label: 'Voice AI', icon: Mic },
  { to: '/app/billing', label: 'Obuna', icon: CreditCard },
  { to: '/app/referrals', label: 'Referral', icon: Share2 },
  { to: '/app/notifications', label: 'Bildirishnomalar', icon: Bell },
  { to: '/app/settings', label: 'Sozlamalar', icon: Settings },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, business, actions, state } = useSession()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const unread = state.notifications.filter((n) => n.userId === profile?.id && !n.read).length

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r md:flex md:flex-col">
        <Link to="/app" className="flex items-center gap-2 px-5 py-5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <BarChart3 className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-lg leading-none">SavdoPilot</p>
            <p className="text-[11px] text-muted-foreground">{business?.name ?? 'AI'}</p>
          </div>
        </Link>
        <nav className="flex-1 space-y-0.5 px-3 pb-4">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/app'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted',
                  isActive && 'bg-muted text-foreground',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.to === '/app/notifications' && unread > 0 && (
                <Badge className="ml-auto" tone="gold">
                  {unread}
                </Badge>
              )}
            </NavLink>
          ))}
          {profile?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted',
                  isActive && 'bg-muted text-foreground',
                )
              }
            >
              <Shield className="h-4 w-4" />
              Super Admin
            </NavLink>
          )}
        </nav>
        <div className="flex items-center gap-2 border-t p-3">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Tema">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            className="flex-1 justify-start"
            onClick={() => {
              actions.logout()
              navigate('/')
            }}
          >
            <LogOut className="h-4 w-4" />
            Chiqish
          </Button>
        </div>
      </aside>
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b px-4 py-3 md:hidden">
          <span className="font-display text-lg">SavdoPilot</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/app/ai">
                <MessageSquare className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={toggle}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
        <nav className="sticky bottom-0 grid grid-cols-5 border-t bg-card p-2 md:hidden">
          {[nav[0], nav[1], nav[2], nav[3], nav[11]].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-col items-center gap-1 text-[10px] text-muted-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.label.split(' ')[0]}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
