import { Card } from '@/components/ui/card'
import { useSession } from '@/hooks/use-session'
import { buildInsights } from '@/lib/analytics'
import { Sparkles, TrendingUp, AlertTriangle, Info } from 'lucide-react'

export function InsightsPage() {
  const { business, state } = useSession()
  const orders = state.orders.filter((o) => o.businessId === business?.id)
  const products = state.products.filter((p) => p.businessId === business?.id)
  const transactions = state.transactions.filter((t) => t.businessId === business?.id)
  const insights = buildInsights(orders, products, transactions)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">AI Insights</h1>
        <p className="text-muted-foreground">{business?.name}</p>
      </div>

      <div className="grid gap-4">
        {insights.length === 0 ? (
          <Card className="p-8 text-center">
            <Sparkles className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-semibold">Hali ma'lumot yo‘q</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Tahlil uchun ko‘proq buyurtma va mahsulot ma'lumotlari kerak.
            </p>
          </Card>
        ) : (
          insights.map((insight) => (
            <Card key={insight.title} className="p-4">
              <div className="flex items-start gap-3">
                {insight.tone === 'up' && (
                  <div className="rounded-full bg-green-500/10 p-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </div>
                )}
                {insight.tone === 'warn' && (
                  <div className="rounded-full bg-yellow-500/10 p-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  </div>
                )}
                {insight.tone === 'info' && (
                  <div className="rounded-full bg-blue-500/10 p-2">
                    <Info className="h-4 w-4 text-blue-500" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold">{insight.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{insight.body}</p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Card className="p-6">
        <h2 className="font-semibold">AI qanday ishlaydi?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          AI biznesingizdagi ma'lumotlarni tahlil qilib, quyidagilarni aniqlaydi:
        </p>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• Eng ko‘p sotilgan mahsulotlar</li>
          <li>• Savdo o‘sishi yoki tushishi</li>
          <li>• Xarajat o‘sishi</li>
          <li>• Stock xavfi bor mahsulotlar</li>
          <li>• Mijozlar qaytish tendensiyasi</li>
        </ul>
      </Card>
    </div>
  )
}