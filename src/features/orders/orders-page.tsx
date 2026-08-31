import { useState } from 'react'
import { Badge, Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useSession } from '@/hooks/use-session'
import { orderTotal } from '@/lib/analytics'
import { formatDate, formatSom } from '@/lib/utils'
import type { OrderStatus } from '@/types'

const STATUSES: { id: OrderStatus; label: string }[] = [
  { id: 'new', label: 'Yangi' },
  { id: 'confirmed', label: 'Tasdiqlangan' },
  { id: 'preparing', label: 'Tayyorlanmoqda' },
  { id: 'delivering', label: 'Yetkazilmoqda' },
  { id: 'delivered', label: 'Yetkazildi' },
  { id: 'cancelled', label: 'Bekor qilindi' },
]

export function OrdersPage() {
  const { business, state, actions } = useSession()
  const [tab, setTab] = useState<OrderStatus | 'all'>('new')
  const orders = state.orders.filter((o) => o.businessId === business?.id)
  const list = tab === 'all' ? orders : orders.filter((o) => o.status === tab)

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Buyurtmalar</h1>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={tab === 'all' ? 'default' : 'outline'} onClick={() => setTab('all')}>
          Barchasi
        </Button>
        {STATUSES.map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={tab === s.id ? 'default' : 'outline'}
            onClick={() => setTab(s.id)}
          >
            {s.label}
          </Button>
        ))}
      </div>
      <div className="space-y-3">
        {list.map((o) => {
          const customer = state.customers.find((c) => c.id === o.customerId)
          return (
            <Card key={o.id} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">{customer?.name}</p>
                <p className="text-sm text-muted-foreground">{customer?.phone}</p>
                <p className="text-sm">
                  {o.items.map((i) => `${i.productName} ×${i.quantity}`).join(', ')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {o.delivery ? 'Yetkazib berish' : 'Olib ketish'} · {formatDate(o.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge>{formatSom(orderTotal(o))}</Badge>
                <select
                  className="rounded-xl border bg-card px-2 py-1 text-sm"
                  value={o.status}
                  onChange={(e) => actions.setOrderStatus(o.id, e.target.value as OrderStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
