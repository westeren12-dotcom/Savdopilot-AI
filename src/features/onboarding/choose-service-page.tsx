// Post-signup service-direction chooser. Shown when a user authenticates without
// having picked a product on the homepage (e.g. direct /register).
// Sales → classic business onboarding; invoices → collections pages directly.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductCards, type ProductSelectionCopy } from '@/features/landing/product-selection'
import { actions } from '@/store/app-store'
import { writeSelectedProduct, type ProductType } from '@/lib/product-context'
import { useSession } from '@/hooks/use-session'

const copy: ProductSelectionCopy = {
  automateQuestion: 'Nimani avtomatlashtirmoqchisiz?',
  cta: 'Davom etish',
  sales: {
    title: 'AI Sales',
    subtitle: 'AI sotuvchi, leadlar, buyurtmalar va savdo analitikasi',
    features: ['AI Sales Assistant', 'Lead Management', 'Orders', 'Sales Analytics'],
    workflow: ['Lead', 'Customer', 'Conversation', 'Order', 'Sale'],
    select: 'Tanlash',
    selected: 'Tanlandi',
  },
  invoices: {
    title: 'Invoices & Collections',
    subtitle: 'Invoice tracking, AI eslatmalar va to‘lov kuzatuvi',
    features: ['Invoice Manager', 'Due-date Tracking', 'AI Reminders', 'Promise Tracking'],
    workflow: ['Invoice', 'Due Date', 'AI Follow-up', 'Promise', 'Paid'],
    select: 'Tanlash',
    selected: 'Tanlandi',
  },
}

export function ChooseServicePage() {
  const nav = useNavigate()
  const { profile } = useSession()
  const [selected, setSelected] = useState<ProductType | null>(profile?.productType ?? null)

  function confirm() {
    if (!selected) return
    writeSelectedProduct(selected)
    actions.setProductType(selected)
    if (selected === 'invoices') {
      // Invoices users skip the sales business wizard — their pages are ready.
      actions.updateSettings({ onboardingComplete: true })
      nav('/app/collections', { replace: true })
    } else {
      nav('/onboarding', { replace: true })
    }
  }

  return (
    <div className="mesh grid min-h-screen place-items-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-4xl"
      >
        <p className="text-sm text-muted-foreground">Qadam 1 / 2 — Xizmat turi</p>
        <h1 className="font-display mt-2 text-3xl">Xizmat turini tanlang</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Yo‘nalishni tanlang — dashboardingiz aynan shunga mos ochiladi.
        </p>

        <div className="mt-8">
          <ProductCards copy={copy} selected={selected} onSelect={setSelected} />
        </div>

        <div className="mt-8 flex justify-end">
          <Button size="lg" disabled={!selected} onClick={confirm} className="min-w-44">
            Davom etish
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
