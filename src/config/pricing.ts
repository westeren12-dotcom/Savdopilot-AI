// Canonical pricing — the ONLY place tariffs and discounts live.
// UI, checkout and the (future) server-side payment validation all read from
// here, so a price changed in the browser can never be trusted by the backend:
// it recomputes from planCode + duration instead.
import type { PlanCode, BillingCycle } from '@/types'

export type { PlanCode, BillingCycle }

/** Monthly base price per plan, in UZS. */
export const PLAN_PRICES: Record<Exclude<PlanCode, 'free'>, number> = {
  pro: 144_000,
  premium: 399_000,
}

/** Paid durations with their discount percent (single source — no hardcoded -10%/-25% elsewhere). */
export const DURATIONS: {
  cycle: BillingCycle
  months: number
  discountPercent: number
  label: string
}[] = [
  { cycle: 'monthly', months: 1, discountPercent: 0, label: '1 oy' },
  { cycle: '6m', months: 6, discountPercent: 10, label: '6 oy' },
  { cycle: '12m', months: 12, discountPercent: 25, label: '12 oy' },
]

export function isPaidPlan(code: PlanCode): boolean {
  return code === 'pro' || code === 'premium'
}

export function durationMeta(cycle: BillingCycle) {
  return DURATIONS.find((d) => d.cycle === cycle) ?? DURATIONS[0]
}

export interface PriceQuote {
  planCode: Exclude<PlanCode, 'free'>
  cycle: BillingCycle
  months: number
  discountPercent: number
  /** Original price: monthly base × months. */
  original: number
  /** Final price after discount (rounded to whole so‘m). */
  final: number
  /** original - final. */
  saved: number
}

/**
 * The one reusable price calculator. Every checkout summary, pricing card and
 * the future server-side validation calls this — discounts are never hardcoded
 * at call sites.
 */
export function quotePrice(
  planCode: Exclude<PlanCode, 'free'>,
  cycle: BillingCycle,
): PriceQuote {
  const meta = durationMeta(cycle)
  const original = PLAN_PRICES[planCode] * meta.months
  const final = Math.round(original * (1 - meta.discountPercent / 100))
  return {
    planCode,
    cycle,
    months: meta.months,
    discountPercent: meta.discountPercent,
    original,
    final,
    saved: original - final,
  }
}

/** Legacy helper kept for existing callers (billing page, store). */
export function planPrice(code: PlanCode, cycle: BillingCycle): number {
  if (!isPaidPlan(code)) return 0
  return quotePrice(code as Exclude<PlanCode, 'free'>, cycle).final
}

/** Free-plan features (used by pricing cards). */
export const FREE_FEATURES = [
  '50 AI xabar / oy',
  '30 ta buyurtma / oy',
  'Asosiy CRM',
  'Asosiy statistika',
]
