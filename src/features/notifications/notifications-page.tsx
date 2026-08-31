import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useSession } from '@/hooks/use-session'
import { actions } from '@/store/app-store'
import { Bell, Check, ShoppingBag, AlertTriangle, CreditCard, Share2, Settings } from 'lucide-react'

export function NotificationsPage() {
  const { profile, state } = useSession()
  const notifications = state.notifications
    .filter((n) => n.userId === profile?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const unreadCount = notifications.filter((n) => !n.read).length

  function getIcon(kind: string) {
    switch (kind) {
      case 'order':
        return <ShoppingBag className="h-5 w-5 text-blue-500" />
      case 'stock':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'subscription':
        return <CreditCard className="h-5 w-5 text-purple-500" />
      case 'credits':
        return <CreditCard className="h-5 w-5 text-orange-500" />
      case 'payment':
        return <CreditCard className="h-5 w-5 text-green-500" />
      case 'referral':
        return <Share2 className="h-5 w-5 text-pink-500" />
      case 'system':
        return <Settings className="h-5 w-5 text-gray-500" />
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />
    }
  }

  function formatTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'hozir'
    if (diffMins < 60) return `${diffMins} daqiqa oldin`
    if (diffHours < 24) return `${diffHours} soat oldin`
    if (diffDays < 7) return `${diffDays} kun oldin`
    return date.toLocaleDateString('uz-UZ')
  }

  function markAsRead() {
    actions.markNotificationsRead()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Bildirishnomalar</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} ta o‘qilmagan` : 'Barchasi o‘qilgan'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAsRead}>
            <Check className="mr-2 h-4 w-4" />
            Barchasini o‘qilgan deb belgilash
          </Button>
        )}
      </div>

      <Card>
        <div className="divide-y">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 font-semibold">Bildirishnomalar yo‘q</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Yangi xabarlar bu yerda ko‘rinadi
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start gap-3 p-4 ${!notification.read ? 'bg-primary/5' : ''}`}
              >
                <div className="mt-1">{getIcon(notification.kind)}</div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold">{notification.title}</h4>
                      <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                    </div>
                    {!notification.read && (
                      <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatTime(notification.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}