import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useCredits, useSession } from '@/hooks/use-session'
import { buildInsights, salesSeries, todayMetrics, topProducts } from '@/lib/analytics'
import { formatSom, daysUntil } from '@/lib/utils'

export function DashboardPage() {
  const { business, state } = useSession()
  const credits = useCredits()
  const [range, setRange] = useState<7 | 30>(7)
  const orders = state.orders.filter((o) => o.businessId === business?.id)
  const txs = state.transactions.filter((t) => t.businessId === business?.id)
  const products = state.products.filter((p) => p.businessId === business?.id)
  const customers = state.customers.filter((c) => c.businessId === business?.id)
  const m = todayMetrics(orders, txs)
  const series = salesSeries(orders, range === 30 ? 30 : 7)
  const top = topProducts(orders)
  const insights = buildInsights(orders, products, txs)
  const sub = state.subscriptions.find((s) => s.businessId === business?.id)
  const left = sub ? daysUntil(sub.endAt) : 0
  const todayCustomers = customers.filter((c) => {
    if (!c.lastOrderAt) return false
    const d = new Date(c.lastOrderAt)
    const n = new Date()
    return d.toDateString() === n.toDateString()
  }).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Dashboard</h1>
        <p className="text-muted-foreground">{business?.name}</p>
      </div>
      {left <= 7 && sub && (
        <Card className="border-accent">
          Obuna tugashiga {left} kun qoldi.
        </Card>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Bugungi daromad" value={formatSom(m.revenue)} />
        <Stat label="Bugungi xarajat" value={formatSom(m.expenses)} />
        <Stat label="Taxminiy foyda" value={formatSom(m.profit)} />
        <Stat label="Buyurtmalar" value={String(m.orders)} />
        <Stat label="Yangi mijozlar" value={String(todayCustomers)} />
      </div>
      
      {/* Collections Metrics */}
      <Card className="border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">Invoice Collections</h2>
            <p className="text-sm text-muted-foreground">AI-powered payment tracking</p>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Outstanding</p>
              <p className="text-lg font-semibold">$48,200</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">AI Recovered</p>
              <p className="text-lg font-semibold text-green-500">$8,700</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className="text-lg font-semibold text-red-500">$12,450</p>
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Savdo</h2>
          <div className="flex gap-2 text-sm">
            <button onClick={() => setRange(7)}>7 kun</button>
            <button onClick={() => setRange(30)}>30 kun</button>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="value" fill="var(--primary)" radius={6} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Eng ko‘p sotilgan</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {top.map((p) => (
              <li key={p.name} className="flex justify-between">
                {p.name} <span>{p.qty}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold">AI Credits</h2>
          <p className="mt-2 text-sm">
            {credits.used.toLocaleString()} / {credits.limit.toLocaleString()} used
          </p>
          <Progress className="mt-2" value={(credits.used / Math.max(1, credits.limit)) * 100} />
          <p className="mt-2 text-sm text-muted-foreground">
            Remaining: {credits.remaining.toLocaleString()} credits
          </p>
        </Card>
      </div>
      <Card>
        <h2 className="font-semibold">AI Insights</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {insights.map((i) => (
            <li key={i.title + i.body}>{i.body}</li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-xl">{value}</p>
    </Card>
  )
}
