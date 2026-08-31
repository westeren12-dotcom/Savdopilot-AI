import { Badge } from '@/components/ui/card'
import { useSession } from '@/hooks/use-session'
import { orderTotal } from '@/lib/analytics'
import { formatDate, formatSom } from '@/lib/utils'

export function CustomersPage() {
  const { business, state } = useSession()
  const customers = state.customers.filter((c) => c.businessId === business?.id)
  const orders = state.orders.filter((o) => o.businessId === business?.id)

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">CRM</h1>
      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              {[
                'Ism',
                'Telefon',
                'Telegram',
                'Instagram',
                'Buyurtmalar',
                'Umumiy xarajat',
                'Oxirgi',
                'Status',
              ].map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const cOrders = orders.filter((o) => o.customerId === c.id)
              const spend = cOrders.reduce((s, o) => s + orderTotal(o), 0)
              return (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2">{c.phone}</td>
                  <td className="px-3 py-2">{c.telegram ?? '—'}</td>
                  <td className="px-3 py-2">{c.instagram ?? '—'}</td>
                  <td className="px-3 py-2">{cOrders.length}</td>
                  <td className="px-3 py-2">{formatSom(spend)}</td>
                  <td className="px-3 py-2">{c.lastOrderAt ? formatDate(c.lastOrderAt) : '—'}</td>
                  <td className="px-3 py-2">
                    <Badge>{c.status}</Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
