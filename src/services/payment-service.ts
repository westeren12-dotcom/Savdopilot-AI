// Payment service abstraction. The UI never talks to a payment provider directly:
// it calls createPayment() and polls getPaymentStatus().
//
// Click Billing API is NOT called yet (no merchant credentials). The adapter
// below is the exact seam where it will plug in later — without touching the UI.
//
// SECURITY: server-only Click credentials must never reach the frontend. There
// are deliberately no VITE_* payment vars. CLICK_MERCHANT_ID / CLICK_SERVICE_ID /
// CLICK_SECRET_KEY stay in server-side env (.env is git-ignored).
//
// PRICE TRUST: createPayment() always recomputes the amount from planCode +
// cycle via canonical pricing. Any client-supplied price is ignored, so a
// tampered browser request can never change what gets charged.
import { quotePrice, isPaidPlan, type PriceQuote } from '@/config/pricing'
import type { BillingCycle, PlanCode } from '@/types'

export type PaymentProviderId = 'click' | 'mock'
export type PaymentState = 'pending' | 'success' | 'failed' | 'cancelled'

export interface CreatePaymentInput {
  planCode: Exclude<PlanCode, 'free'>
  cycle: BillingCycle
  /** Optional business scope when checkout happens inside the dashboard. */
  businessId?: string
  /** Client-side quote is accepted only for display; the amount below is canonical. */
  clientQuote?: PriceQuote
}

export interface PaymentIntent {
  id: string
  provider: PaymentProviderId
  state: PaymentState
  /** Canonical quote recomputed server-side (from plan + duration). */
  quote: PriceQuote
  planCode: Exclude<PlanCode, 'free'>
  cycle: BillingCycle
  businessId?: string
  createdAt: string
  /** Redirect URL once a real provider (Click) is configured. */
  checkoutUrl?: string
  message?: string
}

export interface PaymentStatusResult {
  paymentId: string
  state: PaymentState
  /** Subscription fields to persist once success lands. */
  activation?: {
    planCode: PlanCode
    cycle: BillingCycle
    startAt: string
    endAt: string
  }
  message?: string
}

export function isClickConfigured(): boolean {
  // Real check lives server-side (CLICK_MERCHANT_ID / CLICK_SERVICE_ID /
  // CLICK_SECRET_KEY present in the server env). Frontend only gets an honest
  // "not configured yet" signal — no secrets, no fake endpoints.
  return false
}

export function mapPaymentState(s: 'pending' | 'paid' | 'failed'): PaymentState {
  if (s === 'paid') return 'success'
  return s
}

/**
 * Creates a payment intent. Today: mock/queued state. Later: the Click branch
 * below becomes a server call (prices validated server-side against canonical
 * pricing) and returns a real checkout URL.
 */
export async function createPayment(input: CreatePaymentInput): Promise<PaymentIntent> {
  const { planCode, cycle } = input
  if (!isPaidPlan(planCode)) {
    throw new Error('FREE tarif to‘lov talab qilmaydi')
  }
  // Canonical amount — recomputed here, never taken from the client.
  const quote = quotePrice(planCode, cycle)

  if (isClickConfigured()) {
    // === FUTURE CLICK INTEGRATION SEAM ================================
    // POST to your server endpoint with { planCode, cycle, businessId }.
    // The server:
    //   1. re-quotes the price from canonical pricing (never trusts the client),
    //   2. signs the request with CLICK_SECRET_KEY,
    //   3. calls Click Billing API (merchant_id + service_id from server env),
    //   4. returns { paymentId, checkoutUrl }.
    // The frontend then redirects to checkoutUrl and polls getPaymentStatus.
    // ==================================================================
    throw new Error('Click adapter ulanmagan — server endpoint kerak')
  }

  // Mock/demo path: create a pending intent the UI can poll.
  return {
    id: `pay_${crypto.randomUUID().slice(0, 8)}`,
    provider: 'mock',
    state: 'pending',
    quote,
    planCode,
    cycle,
    businessId: input.businessId,
    createdAt: new Date().toISOString(),
    message: 'Mock to‘lov yaratildi (Click hali ulanmagan)',
  }
}

/** Poll a payment's status. Mock resolves success after a short simulated delay. */
export async function getPaymentStatus(payment: PaymentIntent): Promise<PaymentStatusResult> {
  const elapsed = Date.now() - new Date(payment.createdAt).getTime()
  const start = new Date()
  const end = new Date(start)
  end.setMonth(end.getMonth() + payment.quote.months)

  if (payment.provider === 'mock') {
    // Simulate processing, then success. Failed/cancelled are injectable later
    // via query params (?pay=failed) without changing this contract.
    if (elapsed < 1500) {
      return { paymentId: payment.id, state: 'pending' }
    }
    return {
      paymentId: payment.id,
      state: 'success',
      activation: {
        planCode: payment.planCode,
        cycle: payment.cycle,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      },
    }
  }

  // Click path will poll the provider status endpoint here.
  return { paymentId: payment.id, state: payment.state }
}

/** Cancel a pending payment (user navigates away / presses back). */
export async function cancelPayment(payment: PaymentIntent): Promise<PaymentStatusResult> {
  return { paymentId: payment.id, state: 'cancelled', message: 'To‘lov bekor qilindi' }
}
