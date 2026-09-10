// Interactive "What would you like to automate?" cards.
// AI Sales identity: teal + AI chat motion. Invoices identity: green + payment flow motion.
import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Bot, CheckCircle2, FileText, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useTypewriter } from '@/features/landing/landing-animations'
import { cn } from '@/lib/utils'
import type { ProductType } from '@/lib/product-context'

export type ProductSelectionCopy = {
  automateQuestion: string
  cta: string
  sales: {
    title: string
    subtitle: string
    features: string[]
    workflow: string[]
    select: string
    selected: string
  }
  invoices: {
    title: string
    subtitle: string
    features: string[]
    workflow: string[]
    select: string
    selected: string
  }
}

/* ---------- workflow chips that light up in sequence ---------- */

function WorkflowChips({ steps, accent }: { steps: string[]; accent: 'primary' | 'green' }) {
  const reduced = useReducedMotion()
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (reduced) return
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 1200)
    return () => clearInterval(t)
  }, [steps.length, reduced])

  const activeCls =
    accent === 'primary'
      ? 'border-primary/40 bg-primary/10 text-primary'
      : 'border-green-500/40 bg-green-500/10 text-green-500'

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((s, i) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] transition-colors duration-300',
              i === active ? activeCls : 'border-border text-muted-foreground',
            )}
          >
            {s}
          </span>
          {i < steps.length - 1 && <span className="text-[10px] text-muted-foreground">→</span>}
        </span>
      ))}
    </div>
  )
}

/* ---------- mini AI chat teaser (sales card) ---------- */

function SalesMiniChat() {
  const reduced = useReducedMotion()
  const [n, setN] = useState(0)
  const msgs = [
    { who: 'customer' as const, text: 'Narxi qancha?' },
    { who: 'ai' as const, text: '45 000 so‘m. Rasmiylashtiraymi?' },
  ]

  useEffect(() => {
    if (reduced) return
    let alive = true
    let t: ReturnType<typeof setTimeout>
    const loop = () => {
      if (!alive) return
      setN(0)
      t = setTimeout(() => {
        if (!alive) return
        setN(1)
        t = setTimeout(() => {
          if (alive) t = setTimeout(loop, 2400)
        }, 1600)
      }, 1200)
    }
    loop()
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [reduced])

  return (
    <div className="space-y-1.5">
      {msgs.slice(0, reduced ? 2 : n + 1).map((m, i) => (
        <motion.div
          key={`${i}-${m.text}`}
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className={cn(
            'w-fit max-w-[90%] rounded-lg px-2.5 py-1.5 text-[11px]',
            m.who === 'ai' ? 'bg-primary/10' : 'bg-muted',
          )}
        >
          {m.text}
        </motion.div>
      ))}
    </div>
  )
}

/* ---------- invoice card teaser (invoices card) ---------- */

function InvoiceMiniCard() {
  const reduced = useReducedMotion()
  const [stage, setStage] = useState(0)
  const stages = ['unpaid', 'overdue', 'promise', 'paid'] as const
  const labels: Record<(typeof stages)[number], string> = {
    unpaid: 'Unpaid',
    overdue: 'Overdue',
    promise: 'AI Follow-up',
    paid: 'Paid',
  }

  useEffect(() => {
    if (reduced) return
    const t = setInterval(() => setStage((s) => (s + 1) % stages.length), 1800)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  const cur = stages[stage]
  return (
    <div className="rounded-lg border bg-background p-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-green-500" />
          <span className="text-[11px] font-medium">INV-0091</span>
        </div>
        <motion.span
          key={cur}
          initial={reduced ? false : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            'rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
            cur === 'paid' && 'border-primary/30 bg-primary/10 text-primary',
            cur === 'overdue' && 'border-destructive/30 bg-destructive/10 text-destructive',
            cur === 'promise' && 'border-accent/40 bg-accent/20 text-accent-foreground',
            cur === 'unpaid' && 'border-border bg-muted text-muted-foreground',
          )}
        >
          {labels[cur]}
        </motion.span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-green-500"
          animate={{
            width:
              cur === 'paid' ? '100%' : cur === 'promise' ? '65%' : cur === 'overdue' ? '30%' : '10%',
          }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  )
}

/* ---------- full section (scroll target #automate) ---------- */

export function ProductSelection({
  copy,
  selected,
  onSelect,
}: {
  copy: ProductSelectionCopy
  selected: ProductType | null
  onSelect: (p: ProductType) => void
}) {
  const typed = useTypewriter(['savdo', 'to‘lovlar', 'CRM', 'follow-up'], true)

  return (
    <section id="automate" className="mx-auto max-w-6xl px-4 py-16">
      <h2 className="font-display text-3xl">{copy.automateQuestion}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Tanlov: <span className="font-medium text-primary">{typed}</span>
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle" />
      </p>

      <div className="mt-8">
        <ProductCards copy={copy} selected={selected} onSelect={onSelect} />
      </div>
    </section>
  )
}

/** The two product cards — used in the hero grid and the #automate section. */
export function ProductCards({
  copy,
  selected,
  onSelect,
}: {
  copy: ProductSelectionCopy
  selected: ProductType | null
  onSelect: (p: ProductType) => void
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ProductCard
        kind="sales"
        selected={selected === 'sales'}
        onSelect={() => onSelect('sales')}
        title={copy.sales.title}
        subtitle={copy.sales.subtitle}
        features={copy.sales.features}
        workflow={copy.sales.workflow}
        selectLabel={copy.sales.select}
        selectedLabel={copy.sales.selected}
      />
      <ProductCard
        kind="invoices"
        selected={selected === 'invoices'}
        onSelect={() => onSelect('invoices')}
        title={copy.invoices.title}
        subtitle={copy.invoices.subtitle}
        features={copy.invoices.features}
        workflow={copy.invoices.workflow}
        selectLabel={copy.invoices.select}
        selectedLabel={copy.invoices.selected}
      />
    </div>
  )
}

function ProductCard({
  kind,
  selected,
  onSelect,
  title,
  subtitle,
  features,
  workflow,
  selectLabel,
  selectedLabel,
}: {
  kind: 'sales' | 'invoices'
  selected: boolean
  onSelect: () => void
  title: string
  subtitle: string
  features: string[]
  workflow: string[]
  selectLabel: string
  selectedLabel: string
}) {
  const isSales = kind === 'sales'
  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <Card
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect()
          }
        }}
        className={cn(
          'group relative h-full cursor-pointer overflow-hidden p-6 outline-none transition-all duration-300',
          isSales ? 'border-primary/20' : 'border-green-500/20',
          selected
            ? isSales
              ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10 ring-2 ring-primary/60'
              : 'border-green-500 bg-green-500/5 shadow-lg shadow-green-500/10 ring-2 ring-green-500/60'
            : isSales
              ? 'bg-primary/5 hover:border-primary/40 hover:shadow-md'
              : 'bg-green-500/5 hover:border-green-500/40 hover:shadow-md',
        )}
      >
        <CheckBadge visible={selected} accent={isSales ? 'primary' : 'green'} />
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-105',
              isSales ? 'bg-primary/10' : 'bg-green-500/10',
            )}
          >
            {isSales ? (
              <Bot className="h-6 w-6 text-primary" />
            ) : (
              <FileText className="h-6 w-6 text-green-500" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-border/60 bg-background/60 p-3">
          {isSales ? (
            <SalesMiniChat />
          ) : (
            <>
              <InvoiceMiniCard />
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-accent" />
                AI payment reminder sent · Response understood · Promise tracked
              </div>
            </>
          )}
        </div>

        <div className="mt-4">
          <WorkflowChips steps={workflow} accent={isSales ? 'primary' : 'green'} />
        </div>

        <ul className="mt-4 flex flex-wrap gap-2">
          {features.map((f) => (
            <li
              key={f}
              className="inline-flex items-center rounded-full bg-background px-2 py-1 text-xs text-muted-foreground"
            >
              {f}
            </li>
          ))}
        </ul>

        <p
          className={cn(
            'mt-4 flex items-center gap-1.5 text-sm font-medium',
            isSales ? 'text-primary' : 'text-green-500',
          )}
        >
          {selected ? selectedLabel : selectLabel}
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </p>
      </Card>
    </motion.div>
  )
}

function CheckBadge({ visible, accent }: { visible: boolean; accent: 'primary' | 'green' }) {
  if (!visible) return null
  return (
    <motion.span
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 20 }}
      className={cn(
        'absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full',
        accent === 'primary' ? 'bg-primary text-primary-foreground' : 'bg-green-500 text-white',
      )}
    >
      <CheckCircle2 className="h-4 w-4" />
    </motion.span>
  )
}
