export type PaymentProviderId = 'mock' | 'click' | 'payme' | 'uzum' | 'stripe'

export interface ChargeInput {
  amount: number
  description: string
  businessId: string
  provider?: PaymentProviderId
}

export interface ChargeResult {
  id: string
  status: 'pending' | 'paid' | 'failed'
  provider: PaymentProviderId
  checkoutUrl?: string
}

export interface PaymentGateway {
  charge(input: ChargeInput): Promise<ChargeResult>
}

export const mockPayment: PaymentGateway = {
  async charge(input) {
    return {
      id: `pay_${crypto.randomUUID().slice(0, 8)}`,
      status: 'paid',
      provider: input.provider ?? 'mock',
    }
  },
}

/** Swap this for Click / Payme / Uzum / Stripe adapters later. */
export function getPaymentGateway(): PaymentGateway {
  return mockPayment
}
