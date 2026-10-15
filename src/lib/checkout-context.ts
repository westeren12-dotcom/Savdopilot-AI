// Checkout selection persistence. The plan+duration picked on /pricing must
// survive the login/register round-trip (localStorage) and the Google popup
// handoff (sessionStorage), mirroring product-context.
import { quotePrice, isPaidPlan } from '@/config/pricing'
import type { BillingCycle, PlanCode } from '@/types'

const KEY = 'savdopilot.checkoutPlan'
const SESSION_KEY = 'savdopilot.pendingCheckout'

export interface PendingCheckout {
  planCode: Exclude<PlanCode, 'free'>
  cycle: BillingCycle
  /** Price captured at selection time — display only, never charged. */
  price: number
}

function isValid(v: unknown): v is PendingCheckout {
  return (
    typeof v === 'object' &&
    v !== null &&
    isPaidPlan((v as PendingCheckout).planCode) &&
    typeof (v as PendingCheckout).cycle === 'string' &&
    ['monthly', '6m', '12m'].includes((v as PendingCheckout).cycle)
  )
}

export function readPendingCheckout(): PendingCheckout | null {
  try {
    const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as PendingCheckout
    if (!isValid(v)) return null
    // Re-quote canonically so a stale/tampered price never reaches the UI summary.
    return { ...v, price: quotePrice(v.planCode, v.cycle).final }
  } catch {
    return null
  }
}

export function writePendingCheckout(planCode: Exclude<PlanCode, 'free'>, cycle: BillingCycle) {
  const payload: PendingCheckout = { planCode, cycle, price: quotePrice(planCode, cycle).final }
  try {
    localStorage.setItem(KEY, JSON.stringify(payload))
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function clearPendingCheckout() {
  try {
    localStorage.removeItem(KEY)
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}
