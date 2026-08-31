import type { Order, Product, Transaction } from '@/types'

export function orderTotal(order: Order): number {
  return order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) + order.deliveryFee
}

export function orderCost(order: Order): number {
  return order.items.reduce((s, i) => s + i.cost * i.quantity, 0)
}

function isSameDay(iso: string, date: Date): boolean {
  const d = new Date(iso)
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  )
}

export function todayMetrics(orders: Order[], transactions: Transaction[]) {
  const now = new Date()
  const todayOrders = orders.filter((o) => isSameDay(o.createdAt, now) && o.status !== 'cancelled')
  const revenue = todayOrders.reduce((s, o) => s + orderTotal(o), 0)
  const cogs = todayOrders.reduce((s, o) => s + orderCost(o), 0)
  const expenses = transactions
    .filter((t) => t.type === 'expense' && isSameDay(t.createdAt, now))
    .reduce((s, t) => s + t.amount, 0)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const yRev = orders
    .filter((o) => isSameDay(o.createdAt, yesterday) && o.status !== 'cancelled')
    .reduce((s, o) => s + orderTotal(o), 0)
  const growth = yRev === 0 ? (revenue > 0 ? 100 : 0) : ((revenue - yRev) / yRev) * 100
  return {
    revenue,
    expenses: expenses + cogs,
    profit: revenue - expenses - cogs,
    orders: todayOrders.length,
    growth,
  }
}

export function salesSeries(orders: Order[], days: number) {
  const points: { label: string; value: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const value = orders
      .filter((o) => isSameDay(o.createdAt, d) && o.status !== 'cancelled')
      .reduce((s, o) => s + orderTotal(o), 0)
    points.push({
      label: d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' }),
      value,
    })
  }
  return points
}

export function topProducts(orders: Order[]) {
  const map = new Map<string, number>()
  for (const o of orders) {
    if (o.status === 'cancelled') continue
    for (const i of o.items) {
      map.set(i.productName, (map.get(i.productName) ?? 0) + i.quantity)
    }
  }
  return [...map.entries()]
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
}

export function financeTotals(transactions: Transaction[]) {
  const revenue = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const profit = revenue - expenses
  const margin = revenue === 0 ? 0 : (profit / revenue) * 100
  return { revenue, expenses, profit, margin }
}

export function buildInsights(orders: Order[], products: Product[], transactions: Transaction[]) {
  const top = topProducts(orders)
  const m = todayMetrics(orders, transactions)
  const low = products.filter((p) => p.stock <= p.minStock)
  const items: { title: string; body: string; tone: 'up' | 'warn' | 'info' }[] = []
  items.push({
    title: 'Savdo dinamikasi',
    body:
      m.growth >= 0
        ? `Bugun savdo kechagiga qaraganda ${Math.round(m.growth)}% oshdi.`
        : `Bugun savdo kechagiga qaraganda ${Math.abs(Math.round(m.growth))}% kamaydi.`,
    tone: m.growth >= 0 ? 'up' : 'warn',
  })
  if (top[0]) {
    items.push({
      title: 'Eng ko‘p sotilgan',
      body: `${top[0].name} eng ko‘p sotilgan mahsulot (${top[0].qty} dona).`,
      tone: 'info',
    })
  }
  if (top.length > 1) {
    const last = top[top.length - 1]
    items.push({
      title: 'Eng kam sotilgan',
      body: `${last.name} hozircha kam sotilmoqda.`,
      tone: 'info',
    })
  }
  for (const p of low) {
    items.push({
      title: 'Stock xavfi',
      body: `${p.name} stocki tugashiga yaqin (${p.stock} ta).`,
      tone: 'warn',
    })
  }
  return items
}
