import type { AiCreditPack, BillingCycle, PlanCode } from '@/types'

export type { BillingCycle, PlanCode }

export const PLAN_PRICES: Record<PlanCode, number> = {
  free: 0,
  pro: 149_000,
  premium: 399_000,
}

export const PLAN_LIMITS: Record<
  PlanCode,
  { aiMessages: number; orders: number; staff: number }
> = {
  free: { aiMessages: 50, orders: 30, staff: 1 },
  pro: { aiMessages: 2_000, orders: 10_000, staff: 5 },
  premium: { aiMessages: 10_000, orders: 50_000, staff: 10 },
}

export const CYCLE_BONUS: Record<
  BillingCycle,
  { extraMonths: number; label: string }
> = {
  monthly: { extraMonths: 0, label: 'Oylik' },
  '6m': { extraMonths: 1, label: '6 oy + 1 oy bonus' },
  '12m': { extraMonths: 2, label: '12 oy + 2 oy bonus' },
}

export const CREDIT_PACKS: AiCreditPack[] = [
  { id: 'pack-5k', credits: 5_000, price: 49_000 },
  { id: 'pack-10k', credits: 10_000, price: 89_000 },
  { id: 'pack-25k', credits: 25_000, price: 199_000 },
]

export function cycleMultiplier(cycle: BillingCycle): number {
  if (cycle === '6m') return 6
  if (cycle === '12m') return 12
  return 1
}

export function planPrice(code: PlanCode, cycle: BillingCycle): number {
  return PLAN_PRICES[code] * cycleMultiplier(cycle)
}

export function creditBonusPercent(code: PlanCode, cycle: BillingCycle): number {
  if (cycle === 'monthly') return 0
  if (cycle === '6m') return code === 'premium' ? 50 : 30
  if (code === 'premium') return 100
  return 50
}

export function effectiveAiLimit(code: PlanCode, cycle: BillingCycle): number {
  const base = PLAN_LIMITS[code].aiMessages
  return Math.round(base * (1 + creditBonusPercent(code, cycle) / 100))
}

export const FEATURES: Record<PlanCode, string[]> = {
  free: ['50 AI xabar / oy', '30 ta buyurtma / oy', 'Asosiy CRM', 'Asosiy statistika'],
  pro: [
    'AI-Sotuvchi',
    '2 000 AI xabar / oy',
    'Telegram',
    'Buyurtmalar',
    'CRM',
    'Ombor',
    'Moliya',
    'Kengaytirilgan analitika',
    '5 xodim',
  ],
  premium: [
    'Pro’dagi barcha funksiyalar',
    '10 000 AI xabar / oy',
    'Telegram + Instagram',
    'Voice AI',
    'Advanced AI Insights',
    '10 xodim',
    'Multi-branch',
    'Priority support',
  ],
}
