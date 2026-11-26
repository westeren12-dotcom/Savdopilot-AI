import { CREDIT_PACKS } from '@/config/plans'
import type { AppState } from '@/store/state'

/**
 * The state a real (non-demo) session starts from.
 *
 * Deliberately empty: seeded demo users, businesses, orders, subscriptions and
 * payments must never be presented as an organization's data. Real records come
 * from the API; until a screen is wired to it, the honest answer is "nothing
 * yet", not a made-up number.
 */
export function createEmptyState(): AppState {
  return {
    sessionUserId: null,
    passwords: {},
    profiles: [],
    businesses: [],
    categories: [],
    products: [],
    customers: [],
    orders: [],
    conversations: [],
    messages: [],
    transactions: [],
    subscriptions: [],
    payments: [],
    referrals: [],
    notifications: [],
    integrations: [],
    tickets: [],
    invoices: [],
    followups: [],
    aiUsed: {},
    extraCredits: {},
    // Pack prices are configuration (not demo records), so they stay available.
    creditPackPrices: CREDIT_PACKS.map((p) => ({ ...p })),
  }
}
