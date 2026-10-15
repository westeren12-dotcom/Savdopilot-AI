// Checkout page. Plan+duration come from checkout-context (survives auth).
// The price shown is always the canonical re-quote — never the stale client value.
// "Click orqali to‘lash" calls the payment service; until Click credentials are
// configured it shows the honest "not configured yet" state while the whole flow
// (pending → success/failed/cancelled) still runs end-to-end via the mock provider.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DURATIONS,
  durationMeta,
  quotePrice,
  PLAN_PRICES,
} from '@/config/pricing'
import {
  createPayment,
  getPaymentStatus,
  cancelPayment,
  isClickConfigured,
  type PaymentIntent,
} from '@/services/payment-service'
import {
  readPendingCheckout,
  clearPendingCheckout,
  writePendingCheckout,
} from '@/lib/checkout-context'
import { actions } from '@/store/app-store'
import { useSession } from '@/hooks/use-session'
import { formatSom } from '@/lib/utils'
import type { BillingCycle } from '@/types'

const PLAN_LABELS = { pro: 'PRO', premium: 'PREMIUM' } as const

type Phase = 'summary' | 'processing' | 'success' | 'failed' | 'cancelled'

export function CheckoutPage() {
  const nav = useNavigate()
  const { business } = useSession()
  const pending = useMemo(() => readPendingCheckout(), [])
  const [cycle, setCycle] = useState<BillingCycle>(pending?.cycle ?? 'monthly')
  const [phase, setPhase] = useState<Phase>('summary')
  const [payment, setPayment] = useState<PaymentIntent | null>(null)

  const planCode = pending?.planCode ?? 'pro'

  // Keep the stored selection in sync when the user flips the duration.
  useEffect(() => {
    if (phase === 'summary') writePendingCheckout(planCode, cycle)
  }, [cycle, planCode, phase])

  const quote = quotePrice(planCode, cycle)
  const meta = durationMeta(cycle)

  // Poll while processing.
  useEffect(() => {
    if (phase !== 'processing' || !payment) return
    const t = setInterval(async () => {
      const res = await getPaymentStatus(payment)
      if (res.state === 'pending') return
      clearInterval(t)
      if (res.state === 'success' && res.activation) {
        actions.activateSubscription({
          planCode: res.activation.planCode,
          cycle: res.activation.cycle,
          startAt: res.activation.startAt,
          endAt: res.activation.endAt,
          paymentId: res.paymentId,
          amount: payment.quote.final,
          provider: payment.provider,
        })
        clearPendingCheckout()
        setPhase('success')
      } else if (res.state === 'cancelled') {
        setPhase('cancelled')
      } else {
        setPhase('failed')
      }
    }, 600)
    return () => clearInterval(t)
  }, [phase, payment])

  async function handlePay() {
    if (!isClickConfigured()) {
      toast.info('Click payment integration is not configured yet — demo to‘lov ishlatildi')
    }
    setPhase('processing')
    try {
      const intent = await createPayment({
        planCode,
        cycle,
        businessId: business?.id,
        clientQuote: quote,
      })
      setPayment(intent)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'To‘lov yaratishda xato')
      setPhase('failed')
    }
  }

  async function handleCancel() {
    if (payment) await cancelPayment(payment)
    setPhase('cancelled')
  }

  function backToPricing() {
    nav('/pricing', { replace: false })
  }

  // ---------- SUCCESS ----------
  if (phase === 'success') {
    return (
      <Shell onBack={backToPricing}>
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="p-10 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
            <h1 className="font-display mt-4 text-3xl">To‘lov muvaffaqiyatli!</h1>
            <p className="mt-2 text-muted-foreground">
              {PLAN_LABELS[planCode]} · {meta.label} tarif faollashtirildi.
            </p>
            <div className="mx-auto mt-6 max-w-sm space-y-2 text-sm">
              <Row label="Boshlanish" value={new Date().toLocaleDateString('uz-UZ')} />
              <Row
                label="Tugash"
                value={quoteEndLabel(payment?.quote.months ?? quote.months)}
              />
              <Row label="Holat" value="Active" />
            </div>
            <Button size="lg" className="mt-8 min-w-48" onClick={() => nav('/app', { replace: true })}>
              Dashboardga o‘tish
            </Button>
          </Card>
        </motion.div>
      </Shell>
    )
  }

  // ---------- FAILED / CANCELLED ----------
  if (phase === 'failed' || phase === 'cancelled') {
    return (
      <Shell onBack={backToPricing}>
        <Card className="p-10 text-center">
          {phase === 'failed' ? (
            <XCircle className="mx-auto h-14 w-14 text-red-500" />
          ) : (
            <Loader2 className="mx-auto h-10 w-10 text-muted-foreground" />
          )}
          <h1 className="font-display mt-4 text-2xl">
            {phase === 'failed' ? 'To‘lov amalga oshmadi' : 'To‘lov bekor qilindi'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {phase === 'failed'
              ? 'Yana urinib ko‘ring yoki boshqa muddat tanlang.'
              : 'Xohlasangiz boshqa muddat tanlashingiz mumkin.'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" onClick={backToPricing}>
              Tariflarga qaytish
            </Button>
            <Button onClick={() => setPhase('summary')}>Qayta urinish</Button>
          </div>
        </Card>
      </Shell>
    )
  }

  // ---------- PROCESSING ----------
  if (phase === 'processing') {
    return (
      <Shell onBack={handleCancel}>
        <Card className="p-10 text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <h1 className="font-display mt-4 text-2xl">To‘lov amalga oshirilmoqda…</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {PLAN_LABELS[planCode]} · {meta.label} · {formatSom(quote.final)}
          </p>
          <Button variant="ghost" className="mt-6" onClick={handleCancel}>
            Bekor qilish
          </Button>
        </Card>
      </Shell>
    )
  }

  // ---------- SUMMARY ----------
  return (
    <Shell onBack={backToPricing}>
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        {/* Left: plan + duration picker */}
        <Card className="p-6 md:p-8">
          <p className="text-sm text-muted-foreground">Tanlangan tarif</p>
          <div className="mt-2 flex items-baseline gap-3">
            <h1 className="font-display text-3xl uppercase">{PLAN_LABELS[planCode]}</h1>
            <span className="text-sm text-muted-foreground">
              {formatSom(PLAN_PRICES[planCode])}/oy
            </span>
          </div>

          <p className="mt-8 text-sm font-medium">Muddatni tanlang</p>
          <div className="mt-3 grid grid-cols-3 gap-2" role="tablist" aria-label="Muddat">
            {DURATIONS.map((d) => (
              <button
                key={d.cycle}
                role="tab"
                aria-selected={cycle === d.cycle}
                onClick={() => setCycle(d.cycle)}
                className={`rounded-xl border px-3 py-3 text-center transition ${
                  cycle === d.cycle
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <span className="block text-sm font-semibold">{d.label}</span>
                {d.discountPercent > 0 && (
                  <span className="mt-0.5 block text-xs font-medium text-green-700">
                    -{d.discountPercent}%
                  </span>
                )}
              </button>
            ))}
          </div>

          <ul className="mt-8 space-y-2 text-sm text-muted-foreground">
            <li>• Har qanday vaqtda bekor qilish mumkin</li>
            <li>• To‘lovlar Click orqali xavfsiz amalga oshadi</li>
            <li>• Chegirma avtomatik hisoblanadi</li>
          </ul>
        </Card>

        {/* Right: summary */}
        <Card className="h-fit p-6 md:p-8 lg:sticky lg:top-6">
          <h2 className="font-display text-xl">Buyurtma xulosasi</h2>
          <div className="mt-5 space-y-3 text-sm">
            <Row label="Tarif" value={PLAN_LABELS[planCode]} />
            <Row label="Muddat" value={meta.label} />
            <Row label="Original narx" value={formatSom(quote.original)} />
            {quote.discountPercent > 0 && (
              <Row
                label="Chegirma"
                value={`-${quote.discountPercent}%  (−${formatSom(quote.saved)})`}
                accent
              />
            )}
            <div className="border-t pt-3">
              <Row label="Yakuniy narx" value={formatSom(quote.final)} strong />
            </div>
          </div>

          <Button
            size="lg"
            className="mt-6 w-full"
            onClick={handlePay}
            disabled={phase !== 'summary'}
          >
            Click orqali to‘lash
          </Button>

          {!isClickConfigured() && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Click hali ulanmagan — demo to‘lov sinov uchun ishlaydi
            </p>
          )}

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Xavfsiz to‘lov · 256-bit shifrlash
          </p>
        </Card>
      </div>
    </Shell>
  )
}

function quoteEndLabel(months: number) {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toLocaleDateString('uz-UZ')
}

function Row({
  label,
  value,
  accent,
  strong,
}: {
  label: string
  value: string
  accent?: boolean
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? 'font-semibold' : 'text-muted-foreground'}>{label}</span>
      <span
        className={`${strong ? 'font-display text-lg font-semibold' : 'font-medium'} ${
          accent ? 'text-green-700' : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function Shell({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div className="mesh min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <button
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Tariflarga qaytish
        </button>
        {children}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Savol bor? <Link to="/pricing" className="underline">Tariflar</Link> bilan tanishing yoki{' '}
          <Link to="/" className="underline">bosh sahifa</Link>ga qayting.
        </p>
      </div>
    </div>
  )
}
