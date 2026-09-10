import type {
  AppNotification,
  Business,
  Category,
  CollectionFollowup,
  Conversation,
  Customer,
  Integration,
  Invoice,
  Message,
  Order,
  PaymentRecord,
  Product,
  Profile,
  Referral,
  Subscription,
  SupportTicket,
  Transaction,
} from '@/types'

export interface AppState {
  sessionUserId: string | null
  /** Homepage direction chosen before sign-in completes. */
  productTypePending?: 'sales' | 'invoices'
  profiles: Profile[]
  passwords: Record<string, string>
  businesses: Business[]
  products: Product[]
  categories: Category[]
  customers: Customer[]
  orders: Order[]
  conversations: Conversation[]
  messages: Message[]
  transactions: Transaction[]
  subscriptions: Subscription[]
  payments: PaymentRecord[]
  referrals: Referral[]
  notifications: AppNotification[]
  integrations: Integration[]
  tickets: SupportTicket[]
  invoices: Invoice[]
  followups: CollectionFollowup[]
  aiUsed: Record<string, number>
  extraCredits: Record<string, number>
  creditPackPrices: { id: string; credits: number; price: number }[]
}
