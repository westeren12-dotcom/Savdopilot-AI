import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { useSession } from '@/hooks/use-session'
import { actions } from '@/store/app-store'
import { formatSom } from '@/lib/utils'
import { Wallet, TrendingUp, TrendingDown, Plus, FileText, DollarSign } from 'lucide-react'
import type { TransactionType, ExpenseCategory } from '@/types'
import { Link } from 'react-router-dom'

export function FinancePage() {
  const { business, state } = useSession()
  const [showAdd, setShowAdd] = useState(false)
  const [newTx, setNewTx] = useState({
    type: 'income' as TransactionType,
    category: 'other' as ExpenseCategory | 'orders' | 'other_income',
    amount: '',
    note: '',
  })

  const transactions = state.transactions.filter((t) => t.businessId === business?.id)
  const income = transactions.filter((t) => t.type === 'income')
  const expenses = transactions.filter((t) => t.type === 'expense')
  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0)
  const profit = totalIncome - totalExpenses
  const profitMargin = totalIncome > 0 ? ((profit / totalIncome) * 100).toFixed(1) : '0'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!business) return
    actions.addTransaction({
      type: newTx.type,
      category: newTx.category,
      amount: Number(newTx.amount),
      note: newTx.note,
    })
    setNewTx({ type: 'income', category: 'other', amount: '', note: '' })
    setShowAdd(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Moliya</h1>
          <p className="text-muted-foreground">{business?.name}</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>
          <Plus className="mr-2 h-4 w-4" />
          {showAdd ? 'Bekor qilish' : 'Tranzaksiya qo‘shish'}
        </Button>
      </div>

      {showAdd && (
        <Card className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Turi</Label>
                <select
                  className="flex h-10 w-full rounded-xl border bg-card px-3 text-sm outline-none ring-ring focus:ring-2"
                  value={newTx.type}
                  onChange={(e) => setNewTx({ ...newTx, type: e.target.value as TransactionType })}
                >
                  <option value="income">Daromad</option>
                  <option value="expense">Xarajat</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Kategoriya</Label>
                <select
                  className="flex h-10 w-full rounded-xl border bg-card px-3 text-sm outline-none ring-ring focus:ring-2"
                  value={newTx.category}
                  onChange={(e) => setNewTx({ ...newTx, category: e.target.value as any })}
                >
                  {newTx.type === 'income' ? (
                    <>
                      <option value="orders">Buyurtmalar</option>
                      <option value="other_income">Boshqa daromadlar</option>
                    </>
                  ) : (
                    <>
                      <option value="product">Mahsulot</option>
                      <option value="rent">Ijara</option>
                      <option value="ads">Reklama</option>
                      <option value="transport">Transport</option>
                      <option value="other">Boshqa</option>
                    </>
                  )}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Miqdor (so‘m)</Label>
              <Input
                type="number"
                value={newTx.amount}
                onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Izoh</Label>
              <Input
                value={newTx.note}
                onChange={(e) => setNewTx({ ...newTx, note: e.target.value })}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Qo‘shish
            </Button>
          </form>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <p className="text-sm text-muted-foreground">Daromad</p>
          </div>
          <p className="mt-2 font-display text-xl">{formatSom(totalIncome)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            <p className="text-sm text-muted-foreground">Xarajat</p>
          </div>
          <p className="mt-2 font-display text-xl">{formatSom(totalExpenses)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">Foyda</p>
          </div>
          <p className="mt-2 font-display text-xl">{formatSom(profit)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Foyda marjasi</p>
          <p className="mt-2 font-display text-xl">{profitMargin}%</p>
        </Card>
      </div>

      {/* Collections Quick Access */}
      <Card className="border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Invoice Collections</h2>
              <p className="text-sm text-muted-foreground">AI-powered invoice tracking and follow-ups</p>
            </div>
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
            <Button asChild>
              <Link to="/app/collections">
                Open Collections
                <DollarSign className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="p-4 font-semibold">Tranzaksiyalar</h2>
        <div className="divide-y">
          {transactions.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Tranzaksiyalar yo‘q</p>
          ) : (
            transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{t.note}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.category} · {new Date(t.createdAt).toLocaleDateString('uz-UZ')}
                  </p>
                </div>
                <p
                  className={`font-display font-medium ${
                    t.type === 'income' ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {t.type === 'income' ? '+' : '-'}
                  {formatSom(t.amount)}
                </p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}