export const BUSINESS_TYPES = [
  { id: 'restaurant', label: 'Restoran', emoji: '🍕' },
  { id: 'barbershop', label: 'Barbershop', emoji: '💈' },
  { id: 'dental', label: 'Stomatologiya', emoji: '🦷' },
  { id: 'online_shop', label: 'Online shop', emoji: '👗' },
  { id: 'education', label: 'O‘quv markazi', emoji: '📚' },
  { id: 'service', label: 'Servis', emoji: '🔧' },
  { id: 'store', label: 'Do‘kon', emoji: '🏪' },
  { id: 'other', label: 'Boshqa', emoji: '➕' },
] as const

export type BusinessType = (typeof BUSINESS_TYPES)[number]['id']

export type UserRole = 'owner' | 'staff' | 'admin'
export type PlanCode = 'free' | 'pro' | 'premium'
export type BillingCycle = 'monthly' | '6m' | '12m'
export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'preparing'
  | 'delivering'
  | 'delivered'
  | 'cancelled'
export type ConversationStatus = 'ai' | 'human' | 'closed'
export type ConversationChannel = 'web' | 'telegram' | 'instagram' | 'voice'
export type CustomerStatus = 'new' | 'active' | 'vip' | 'inactive'
export type TransactionType = 'income' | 'expense'
export type ExpenseCategory = 'product' | 'rent' | 'ads' | 'transport' | 'other'
export type IntegrationStatus = 'connected' | 'disconnected'
export type TicketStatus = 'open' | 'pending' | 'closed'
export type NotificationKind =
  | 'order'
  | 'stock'
  | 'subscription'
  | 'credits'
  | 'payment'
  | 'referral'
  | 'system'

export interface Profile {
  id: string
  email: string
  fullName: string
  role: UserRole
  blocked: boolean
  referralCode: string
  referredByCode?: string
  createdAt: string
}

export interface Business {
  id: string
  ownerId: string
  name: string
  type: BusinessType
  phone: string
  address: string
  workingHours: string
  telegram: string
  instagram: string
  onboardingComplete: boolean
  aiPersona: string
  aiWelcome: string
  aiLanguage: string
  createdAt: string
}

export interface Branch {
  id: string
  businessId: string
  name: string
  address: string
}

export interface BusinessMember {
  id: string
  businessId: string
  userId: string
  role: UserRole
}

export interface Category {
  id: string
  businessId: string
  name: string
}

export interface Product {
  id: string
  businessId: string
  categoryId: string
  name: string
  price: number
  cost: number
  stock: number
  minStock: number
  description: string
  image?: string
  active: boolean
}

export interface Customer {
  id: string
  businessId: string
  name: string
  phone: string
  telegram?: string
  instagram?: string
  status: CustomerStatus
  lastOrderAt?: string
  notes?: string
}

export interface OrderItem {
  id: string
  orderId: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  cost: number
}

export interface Order {
  id: string
  businessId: string
  customerId: string
  status: OrderStatus
  delivery: boolean
  deliveryFee: number
  notes?: string
  createdAt: string
  items: OrderItem[]
}

export interface Conversation {
  id: string
  businessId: string
  customerId?: string
  customerName: string
  channel: ConversationChannel
  status: ConversationStatus
  lastMessageAt: string
}

export interface Message {
  id: string
  conversationId: string
  role: 'customer' | 'ai' | 'human' | 'system'
  content: string
  createdAt: string
}

export interface Transaction {
  id: string
  businessId: string
  type: TransactionType
  category: ExpenseCategory | 'orders' | 'other_income'
  amount: number
  note: string
  createdAt: string
}

export interface SubscriptionPlan {
  id: string
  code: PlanCode
  name: string
  monthlyPrice: number
  aiMessageLimit: number
  orderLimit: number
  staffLimit: number
  features: string[]
}

export interface Subscription {
  id: string
  businessId: string
  planCode: PlanCode
  cycle: BillingCycle
  startAt: string
  endAt: string
  bonusDays: number
  autoRenew: boolean
}

export interface PaymentRecord {
  id: string
  businessId: string
  provider: 'mock' | 'click' | 'payme' | 'uzum' | 'stripe'
  amount: number
  status: 'pending' | 'paid' | 'failed'
  description: string
  createdAt: string
}

export interface AiUsage {
  businessId: string
  period: string
  used: number
}

export interface AiCreditPack {
  id: string
  credits: number
  price: number
}

export interface Referral {
  id: string
  ownerUserId: string
  invitedEmail: string
  status: 'pending' | 'success'
  bonusDays: number
  createdAt: string
}

export interface AppNotification {
  id: string
  userId: string
  kind: NotificationKind
  title: string
  body: string
  read: boolean
  createdAt: string
}

export interface Integration {
  id: string
  businessId: string
  provider: 'telegram' | 'instagram'
  status: IntegrationStatus
  botUsername?: string
}

export interface SupportTicket {
  id: string
  userId: string
  subject: string
  body: string
  status: TicketStatus
  createdAt: string
}

export interface AiInsight {
  id: string
  title: string
  body: string
  tone: 'up' | 'warn' | 'info'
}
