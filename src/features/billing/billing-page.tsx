import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/card'
import { useSession } from '@/hooks/use-session'
import { actions } from '@/store/app-store'
import { toast } from 'sonner'
import {
  PLAN_PRICES,
  CYCLE_BONUS,
  creditBonusPercent,
  effectiveAiLimit,
  CREDIT_PACKS,
  type PlanCode,
  type BillingCycle,
} from '@/config/plans'
import { formatSom, daysUntil } from '@/lib/utils'
import { Crown, Sparkles, CreditCard } from 'lucide-react'

export function BillingPage() {
  const { business, state } = useSession()
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>('pro')
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('monthly')
  const [loading, setLoading] = useState(false)

  const sub = state.subscriptions.find((s) => s.businessId === business?.id)
  const payments = state.payments.filter((p) => p.businessId === business?.id)
  const daysLeft = sub ? daysUntil(sub.endAt) : 0

  async function handleSubscribe() {
    setLoading(true)
    try {
      await actions.checkoutPlan(selectedPlan, selectedCycle)
      toast.success('To‘lov muvaffaqiyatli!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik')
    } finally {
      setLoading(false)
    }
  }

  async function handleBuyCredits(packId: string) {
    setLoading(true)
    try {
      await actions.buyCredits(packId)
      toast.success('AI credits qo‘shildi!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Obuna</h1>
        <p className="text-muted-foreground">{business?.name}</p>
      </div>

      {/* Current subscription */}
      {sub && (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Hozirgi obuna</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {sub.planCode.toUpperCase()} · {CYCLE_BONUS[sub.cycle].label}
              </p>
              <p className="mt-2 text-sm">
                Tugashiga{' '}
                <span className={daysLeft <= 7 ? 'text-red-500 font-semibold' : ''}>
                  {daysLeft} kun
                </span>{' '}
                qoldi
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl">{formatSom(PLAN_PRICES[sub.planCode])}</p>
              <p className="text-xs text-muted-foreground">oyiga</p>
            </div>
          </div>
        </Card>
      )}

      {/* Plan selection */}
      <div>
        <h2 className="font-semibold mb-4">Tarifni tanlang</h2>
        <div className="mb-4 flex gap-2">
          {(['monthly', '6m', '12m'] as BillingCycle[]).map((cycle) => (
            <Button
              key={cycle}
              variant={selectedCycle === cycle ? 'default' : 'outline'}
              onClick={() => setSelectedCycle(cycle)}
            >
              {CYCLE_BONUS[cycle as keyof typeof CYCLE_BONUS].label}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {(['free', 'pro', 'premium'] as PlanCode[]).map((code) => (
            <Card
              key={code}
              className={`p-6 ${selectedPlan === code ? 'ring-2 ring-primary' : ''} ${
                code === 'premium' && selectedCycle === '12m' ? 'relative' : ''
              }`}
            >
              {code === 'premium' && selectedCycle === '12m' && (
                <Badge tone="gold" className="absolute -top-2 left-1/2 -translate-x-1/2">
                  Eng yaxshi qiymat
                </Badge>
              )}
              <div className="flex items-center gap-2 mb-2">
                {code === 'premium' && <Crown className="h-5 w-5 text-primary" />}
                {code === 'pro' && <Sparkles className="h-5 w-5 text-primary" />}
                <h3 className="font-display text-xl uppercase">{code}</h3>
              </div>
              <div className="mb-4">
                <p className="font-display text-3xl">
                  {formatSom(
                    code === 'free'
                      ? 0
                      : PLAN_PRICES[code as keyof typeof PLAN_PRICES] *
                          (selectedCycle === '12m' ? 12 : selectedCycle === '6m' ? 6 : 1),
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedCycle === 'monthly' ? 'oyiga' : 'jami'}
                </p>
              </div>

              {selectedCycle !== 'monthly' && (
                <div className="mb-4 rounded-lg bg-primary/10 p-2 text-sm">
                  <p className="font-medium">Bonuslar:</p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    <li>• +{CYCLE_BONUS[selectedCycle as keyof typeof CYCLE_BONUS].extraMonths} oy bepul</li>
                    <li>• +{creditBonusPercent(code, selectedCycle)}% AI credits</li>
                    {code === 'premium' && selectedCycle === '12m' && (
                      <li>• 2× AI credits</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="mb-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AI xabarlar:</span>
                  <span className="font-medium">
                    {effectiveAiLimit(code, selectedCycle).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Xodimlar:</span>
                  <span className="font-medium">
                    {code === 'free' ? 1 : code === 'pro' ? 5 : 10}
                  </span>
                </div>
              </div>

              <Button
                className="w-full"
                variant={selectedPlan === code ? 'default' : 'outline'}
                onClick={() => setSelectedPlan(code)}
              >
                {selectedPlan === code ? 'Tanlangan' : 'Tanlash'}
              </Button>
            </Card>
          ))}
        </div>

        <Button
          className="mt-6 w-full"
          size="lg"
          onClick={handleSubscribe}
          disabled={loading || selectedPlan === sub?.planCode}
        >
          {loading ? 'To‘lov qilinmoqda...' : `Obuna bo‘lish (${formatSom(
            selectedPlan === 'free'
              ? 0
              : PLAN_PRICES[selectedPlan as keyof typeof PLAN_PRICES] *
                  (selectedCycle === '12m' ? 12 : selectedCycle === '6m' ? 6 : 1),
          )})`}
        </Button>
      </div>

      {/* AI Credit packs */}
      <div>
        <h2 className="font-semibold mb-4">Qo‘shimcha AI Credits</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {CREDIT_PACKS.map((pack) => (
            <Card key={pack.id} className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">+{pack.credits.toLocaleString()} credits</h3>
              </div>
              <p className="font-display text-2xl mb-4">{formatSom(pack.price)}</p>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => handleBuyCredits(pack.id)}
                disabled={loading}
              >
                {loading ? 'Xarid qilinmoqda...' : 'Sotib olish'}
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {/* Payment history */}
      <Card>
        <h2 className="p-4 font-semibold">To‘lov tarixi</h2>
        <div className="divide-y">
          {payments.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">To‘lovlar yo‘q</p>
          ) : (
            payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{payment.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {payment.provider} · {new Date(payment.createdAt).toLocaleDateString('uz-UZ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display font-medium">{formatSom(payment.amount)}</p>
                  <p
                    className={`text-xs ${
                      payment.status === 'paid' ? 'text-green-500' : 'text-yellow-500'
                    }`}
                  >
                    {payment.status}
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