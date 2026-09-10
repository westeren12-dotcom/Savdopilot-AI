import { PLAN_LIMITS, effectiveAiLimit } from '@/config/plans'
import { demoAiProvider } from '@/services/ai/demo-provider'
import { LIMIT_MESSAGE } from '@/services/credits'
import { getPaymentGateway } from '@/services/payment'
import { instagramService } from '@/services/instagram'
import { telegramService } from '@/services/telegram'
import type {
  AppNotification,
  BillingCycle,
  Business,
  Category,
  CollectionFollowup,
  Conversation,
  Customer,
  Integration,
  Invoice,
  Message,
  Order,
  OrderStatus,
  PaymentRecord,
  PlanCode,
  Product,
  Profile,
  Subscription,
  SupportTicket,
  Transaction,
} from '@/types'
import { addDays, addMonths, monthKey, nowIso, referralCodeFromName, uid } from '@/lib/utils'
import { createDemoState } from '@/data/demo/seed'
import type { AppState } from '@/store/state'

export type { AppState } from '@/store/state'

const KEY = 'savdopilot-demo-v1'

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as AppState
  } catch {
    /* ignore */
  }
  return createDemoState()
}

let state: AppState = typeof window === 'undefined' ? createDemoState() : load()
const listeners = new Set<() => void>()

function persist() {
  localStorage.setItem(KEY, JSON.stringify(state))
}

function emit() {
  persist()
  listeners.forEach((l) => l())
}

export function getState(): AppState {
  return state
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function patch(partial: Partial<AppState>) {
  state = { ...state, ...partial }
  emit()
}

export function currentProfile(): Profile | null {
  return state.profiles.find((p) => p.id === state.sessionUserId) ?? null
}

export function currentBusiness(): Business | null {
  const p = currentProfile()
  if (!p) return null
  if (p.role === 'admin') return state.businesses[0] ?? null
  return state.businesses.find((b) => b.ownerId === p.id) ?? null
}

export function bizId(): string | null {
  return currentBusiness()?.id ?? null
}

function notify(userId: string, kind: AppNotification['kind'], title: string, body: string) {
  const n: AppNotification = {
    id: uid('nt'),
    userId,
    kind,
    title,
    body,
    read: false,
    createdAt: nowIso(),
  }
  state = { ...state, notifications: [n, ...state.notifications] }
}

export const actions = {
  login(email: string, password: string, productType?: 'sales' | 'invoices') {
    const profile = state.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase())
    if (!profile) throw new Error('Email topilmadi')
    if (profile.blocked) throw new Error('Akkount bloklangan')
    if (state.passwords[profile.id] !== password) throw new Error('Parol noto‘g‘ri')
    patch({ sessionUserId: profile.id, ...(productType ? { productType } : {}) })
    if (productType) actions.setProductType(productType)
  },

  loginGoogle(productType?: 'sales' | 'invoices') {
    const demo = state.profiles.find((p) => p.email === 'demo@savdopilot.uz')
    if (!demo) throw new Error('Google demo foydalanuvchi yo‘q')
    patch({ sessionUserId: demo.id })
    if (productType) actions.setProductType(productType)
  },

  /** Stamp the chosen homepage direction onto the profile (persists in localStorage). */
  setProductType(productType: 'sales' | 'invoices') {
    const id = state.sessionUserId
    if (!id) {
      // Not signed in yet: remember globally so it survives the auth round-trip.
      patch({ productTypePending: productType })
      return
    }
    patch({
      productTypePending: undefined,
      profiles: state.profiles.map((p) => (p.id === id ? { ...p, productType } : p)),
    })
  },

  /** Firebase/external sign-in bridge: find or create the local profile + business. */
  loginExternal(input: { email: string; fullName?: string; productType?: 'sales' | 'invoices' }) {
    const existing = state.profiles.find((p) => p.email.toLowerCase() === input.email.toLowerCase())
    if (existing) {
      if (existing.blocked) throw new Error('Akkount bloklangan')
      patch({ sessionUserId: existing.id })
      if (input.productType) actions.setProductType(input.productType)
      return
    }
    const id = uid('usr')
    const bid = uid('biz')
    const name = input.fullName?.trim() || input.email.split('@')[0]
    const profile: Profile = {
      id,
      email: input.email,
      fullName: name,
      role: 'owner',
      blocked: false,
      referralCode: referralCodeFromName(name),
      productType: input.productType,
      createdAt: nowIso(),
    }
    const business: Business = {
      id: bid,
      ownerId: id,
      name: `${name} biznesi`,
      type: 'other',
      phone: '',
      address: '',
      workingHours: '09:00–21:00',
      telegram: '',
      instagram: '',
      onboardingComplete: false,
      aiPersona: 'Do‘stona, qisqa va o‘zbek tilida javob beruvchi AI-sotuvchi.',
      aiWelcome: `Assalomu alaykum! ${name}ga xush kelibsiz.`,
      aiLanguage: 'uz',
      createdAt: nowIso(),
    }
    const start = nowIso()
    const sub: Subscription = {
      id: uid('sub'),
      businessId: bid,
      planCode: 'free',
      cycle: 'monthly',
      startAt: start,
      endAt: addMonths(start, 1),
      bonusDays: 0,
      autoRenew: true,
    }
    patch({
      sessionUserId: id,
      productTypePending: undefined,
      profiles: [...state.profiles, profile],
      businesses: [...state.businesses, business],
      subscriptions: [...state.subscriptions, sub],
      aiUsed: { ...state.aiUsed, [bid]: 0 },
      extraCredits: { ...state.extraCredits, [bid]: 0 },
    })
  },

  logout() {
    patch({ sessionUserId: null })
  },

  register(input: {
    fullName: string
    email: string
    password: string
    businessName: string
    businessType: Business['type']
    referralCode?: string
    productType?: 'sales' | 'invoices'
  }) {
    if (state.profiles.some((p) => p.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error('Bu email allaqachon ro‘yxatdan o‘tgan')
    }
    const id = uid('usr')
    const bizIdNew = uid('biz')
    const profile: Profile = {
      id,
      email: input.email,
      fullName: input.fullName,
      role: 'owner',
      blocked: false,
      referralCode: referralCodeFromName(input.fullName),
      referredByCode: input.referralCode || undefined,
      productType: input.productType ?? state.productTypePending,
      createdAt: nowIso(),
    }
    const business: Business = {
      id: bizIdNew,
      ownerId: id,
      name: input.businessName,
      type: input.businessType,
      phone: '',
      address: '',
      workingHours: '09:00–21:00',
      telegram: '',
      instagram: '',
      onboardingComplete: false,
      aiPersona: 'Do‘stona, qisqa va o‘zbek tilida javob beruvchi AI-sotuvchi.',
      aiWelcome: `Assalomu alaykum! ${input.businessName}ga xush kelibsiz.`,
      aiLanguage: 'uz',
      createdAt: nowIso(),
    }
    const start = nowIso()
    const sub: Subscription = {
      id: uid('sub'),
      businessId: bizIdNew,
      planCode: 'free',
      cycle: 'monthly',
      startAt: start,
      endAt: addMonths(start, 1),
      bonusDays: 0,
      autoRenew: true,
    }

    let referrals = state.referrals
    let businesses = state.businesses
    let subscriptions = [...state.subscriptions, sub]
    if (input.referralCode) {
      const owner = state.profiles.find((p) => p.referralCode === input.referralCode)
      if (owner) {
        const ownerBiz = state.businesses.find((b) => b.ownerId === owner.id)
        if (ownerBiz) {
          subscriptions = subscriptions.map((s) =>
            s.businessId === ownerBiz.id
              ? { ...s, bonusDays: s.bonusDays + 15, endAt: addDays(s.endAt, 15) }
              : s,
          )
          sub.bonusDays += 15
          sub.endAt = addDays(sub.endAt, 15)
          referrals = [
            {
              id: uid('ref'),
              ownerUserId: owner.id,
              invitedEmail: input.email,
              status: 'success',
              bonusDays: 15,
              createdAt: nowIso(),
            },
            ...referrals,
          ]
          notify(owner.id, 'referral', 'Referral bonus', 'Do‘stingiz ro‘yxatdan o‘tdi: +15 kun')
          notify(id, 'referral', 'Referral bonus', 'Sizga +15 kun bonus berildi')
        }
      }
    }

    patch({
      sessionUserId: id,
      productTypePending: undefined, // consumed into profile.productType above
      profiles: [...state.profiles, profile],
      passwords: { ...state.passwords, [id]: input.password },
      businesses: [...businesses, business],
      subscriptions,
      referrals,
      aiUsed: { ...state.aiUsed, [bizIdNew]: 0 },
      extraCredits: { ...state.extraCredits, [bizIdNew]: 0 },
    })
  },

  resetPassword(email: string) {
    const exists = state.profiles.some((p) => p.email.toLowerCase() === email.toLowerCase())
    if (!exists) throw new Error('Email topilmadi')
  },

  completeOnboarding(input: {
    type: Business['type']
    name: string
    phone: string
    address: string
    workingHours: string
    telegram: string
    instagram: string
    products: Omit<Product, 'id' | 'businessId' | 'active'>[]
    aiPersona: string
    aiWelcome: string
  }) {
    const biz = currentBusiness()
    const profile = currentProfile()
    if (!biz || !profile) throw new Error('Sessiya yo‘q')
    const cats: Category[] = []
    const products: Product[] = input.products.map((p) => {
      const catName = p.categoryId || 'Umumiy'
      let cat = cats.find((c) => c.name === catName)
      if (!cat) {
        cat = { id: uid('cat'), businessId: biz.id, name: catName }
        cats.push(cat)
      }
      return {
        id: uid('prd'),
        businessId: biz.id,
        categoryId: cat.id,
        name: p.name,
        price: p.price,
        cost: p.cost,
        stock: p.stock,
        minStock: p.minStock,
        description: p.description,
        image: p.image,
        active: true,
      }
    })
    patch({
      businesses: state.businesses.map((b) =>
        b.id === biz.id
          ? {
              ...b,
              type: input.type,
              name: input.name,
              phone: input.phone,
              address: input.address,
              workingHours: input.workingHours,
              telegram: input.telegram,
              instagram: input.instagram,
              aiPersona: input.aiPersona,
              aiWelcome: input.aiWelcome,
              onboardingComplete: true,
            }
          : b,
      ),
      categories: [...state.categories, ...cats],
      products: [...state.products, ...products],
    })
  },

  upsertProduct(product: Product) {
    const exists = state.products.some((p) => p.id === product.id)
    patch({
      products: exists
        ? state.products.map((p) => (p.id === product.id ? product : p))
        : [...state.products, product],
    })
    if (product.stock <= product.minStock && state.sessionUserId) {
      notify(
        state.sessionUserId,
        'stock',
        '⚠️ Stock tugashiga yaqin',
        `${product.name} qoldig‘i ${product.stock}`,
      )
      emit()
    }
  },

  addCustomer(c: Omit<Customer, 'id'>) {
    const customer: Customer = { ...c, id: uid('cus') }
    patch({ customers: [...state.customers, customer] })
    return customer
  },

  setOrderStatus(orderId: string, status: OrderStatus) {
    patch({
      orders: state.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
    })
  },

  createOrder(input: {
    customerId: string
    items: { productId: string; quantity: number }[]
    delivery: boolean
    notes?: string
  }) {
    const biz = currentBusiness()
    if (!biz) throw new Error('Biznes yo‘q')
    const items = input.items.map((i) => {
      const p = state.products.find((x) => x.id === i.productId)
      if (!p) throw new Error('Mahsulot topilmadi')
      return {
        id: uid('oi'),
        orderId: '',
        productId: p.id,
        productName: p.name,
        quantity: i.quantity,
        unitPrice: p.price,
        cost: p.cost,
      }
    })
    const order: Order = {
      id: uid('ord'),
      businessId: biz.id,
      customerId: input.customerId,
      status: 'new',
      delivery: input.delivery,
      deliveryFee: input.delivery ? 10_000 : 0,
      notes: input.notes,
      createdAt: nowIso(),
      items: items.map((i) => ({ ...i, orderId: '' })),
    }
    order.items = order.items.map((i) => ({ ...i, orderId: order.id }))
    const total = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) + order.deliveryFee
    const products = state.products.map((p) => {
      const line = input.items.find((x) => x.productId === p.id)
      if (!line) return p
      return { ...p, stock: Math.max(0, p.stock - line.quantity) }
    })
    const tx: Transaction = {
      id: uid('tx'),
      businessId: biz.id,
      type: 'income',
      category: 'orders',
      amount: total,
      note: `Buyurtma ${order.id}`,
      createdAt: nowIso(),
    }
    if (state.sessionUserId) {
      notify(state.sessionUserId, 'order', 'Yangi buyurtma', `${formatItems(order)}`)
    }
    patch({
      orders: [order, ...state.orders],
      products,
      transactions: [tx, ...state.transactions],
    })
    return order
  },

  addTransaction(t: Omit<Transaction, 'id' | 'createdAt' | 'businessId'>) {
    const biz = currentBusiness()
    if (!biz) return
    patch({
      transactions: [
        { ...t, id: uid('tx'), businessId: biz.id, createdAt: nowIso() },
        ...state.transactions,
      ],
    })
  },

  async sendAiMessage(conversationId: string, content: string, asHuman: boolean) {
    const biz = currentBusiness()
    const profile = currentProfile()
    if (!biz || !profile) throw new Error('Sessiya yo‘q')
    const sub = state.subscriptions.find((s) => s.businessId === biz.id)
    const plan = sub?.planCode ?? 'free'
    const used = state.aiUsed[biz.id] ?? 0
    const extra = state.extraCredits[biz.id] ?? 0
    const limit = (sub ? effectiveAiLimit(plan, sub.cycle) : PLAN_LIMITS.free.aiMessages) + extra
    const conv = state.conversations.find((c) => c.id === conversationId)
    if (!conv) throw new Error('Suhbat topilmadi')

    const userMsg: Message = {
      id: uid('msg'),
      conversationId,
      role: 'customer',
      content,
      createdAt: nowIso(),
    }
    let messages = [...state.messages, userMsg]

    if (asHuman || conv.status === 'human') {
      patch({
        messages,
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, lastMessageAt: nowIso(), status: 'human' } : c,
        ),
      })
      return
    }

    if (used >= limit) {
      const sys: Message = {
        id: uid('msg'),
        conversationId,
        role: 'system',
        content: LIMIT_MESSAGE,
        createdAt: nowIso(),
      }
      notify(profile.id, 'credits', 'AI limit tugadi', LIMIT_MESSAGE)
      patch({ messages: [...messages, sys] })
      return
    }

    const reply = await demoAiProvider.chat({
      messages: messages
        .filter((m) => m.conversationId === conversationId)
        .map((m) => ({
          role: m.role === 'customer' ? 'user' : 'assistant',
          content: m.content,
        })),
      context: {
        business: biz,
        products: state.products.filter((p) => p.businessId === biz.id),
      },
    })

    const aiMsg: Message = {
      id: uid('msg'),
      conversationId,
      role: 'ai',
      content: reply.text,
      createdAt: nowIso(),
    }
    messages = [...messages, aiMsg]

    if (reply.createdOrder) {
      const product = state.products.find(
        (p) => p.businessId === biz.id && p.name === reply.createdOrder?.productName,
      )
      let customer = state.customers.find((c) => c.id === conv.customerId)
      if (!customer) {
        customer = {
          id: uid('cus'),
          businessId: biz.id,
          name: conv.customerName,
          phone: reply.createdOrder.phone ?? '',
          status: 'new',
        }
        state = { ...state, customers: [...state.customers, customer] }
      }
      if (product) {
        actions.createOrder({
          customerId: customer.id,
          items: [{ productId: product.id, quantity: reply.createdOrder.quantity }],
          delivery: true,
        })
      }
    }

    patch({
      messages,
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, lastMessageAt: nowIso() } : c,
      ),
      aiUsed: { ...state.aiUsed, [biz.id]: used + 1 },
    })
  },

  startConversation(name: string, channel: Conversation['channel']) {
    const biz = currentBusiness()
    if (!biz) return null
    const conv: Conversation = {
      id: uid('cnv'),
      businessId: biz.id,
      customerName: name,
      channel,
      status: 'ai',
      lastMessageAt: nowIso(),
    }
    patch({ conversations: [conv, ...state.conversations] })
    return conv
  },

  takeover(conversationId: string, human: boolean) {
    patch({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, status: human ? 'human' : 'ai' } : c,
      ),
    })
  },

  humanReply(conversationId: string, content: string) {
    const msg: Message = {
      id: uid('msg'),
      conversationId,
      role: 'human',
      content,
      createdAt: nowIso(),
    }
    patch({
      messages: [...state.messages, msg],
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, lastMessageAt: nowIso(), status: 'human' } : c,
      ),
    })
  },

  async checkoutPlan(plan: PlanCode, cycle: BillingCycle) {
    const biz = currentBusiness()
    const profile = currentProfile()
    if (!biz || !profile) throw new Error('Sessiya yo‘q')
    const months = cycle === '12m' ? 12 : cycle === '6m' ? 6 : 1
    const bonus = cycle === '12m' ? 2 : cycle === '6m' ? 1 : 0
    const amount =
      plan === 'free' ? 0 : plan === 'pro' ? 149_000 * months : 399_000 * months
    const pay = await getPaymentGateway().charge({
      amount,
      description: `${plan} ${cycle}`,
      businessId: biz.id,
    })
    const start = nowIso()
    const sub: Subscription = {
      id: uid('sub'),
      businessId: biz.id,
      planCode: plan,
      cycle,
      startAt: start,
      endAt: addMonths(start, months + bonus),
      bonusDays: bonus * 30,
      autoRenew: true,
    }
    const payment: PaymentRecord = {
      id: pay.id,
      businessId: biz.id,
      provider: pay.provider,
      amount,
      status: pay.status,
      description: `${plan.toUpperCase()} ${cycle}`,
      createdAt: nowIso(),
    }
    notify(profile.id, 'payment', 'To‘lov muvaffaqiyatli', payment.description)
    patch({
      subscriptions: [
        sub,
        ...state.subscriptions.filter((s) => s.businessId !== biz.id),
      ],
      payments: [payment, ...state.payments],
    })
  },

  async buyCredits(packId: string) {
    const biz = currentBusiness()
    const profile = currentProfile()
    if (!biz || !profile) return
    const pack = state.creditPackPrices.find((p) => p.id === packId)
    if (!pack) return
    const pay = await getPaymentGateway().charge({
      amount: pack.price,
      description: `+${pack.credits} AI credits`,
      businessId: biz.id,
    })
    notify(profile.id, 'credits', 'AI credits', `+${pack.credits} credits qo‘shildi`)
    patch({
      extraCredits: {
        ...state.extraCredits,
        [biz.id]: (state.extraCredits[biz.id] ?? 0) + pack.credits,
      },
      payments: [
        {
          id: pay.id,
          businessId: biz.id,
          provider: pay.provider,
          amount: pack.price,
          status: pay.status,
          description: `+${pack.credits} AI credits`,
          createdAt: nowIso(),
        },
        ...state.payments,
      ],
    })
  },

  async connectTelegram(token: string) {
    const biz = currentBusiness()
    if (!biz) return
    const res = await telegramService.connect({ botToken: token })
    const existing = state.integrations.find(
      (i) => i.businessId === biz.id && i.provider === 'telegram',
    )
    const row: Integration = {
      id: existing?.id ?? uid('int'),
      businessId: biz.id,
      provider: 'telegram',
      status: res.status,
      botUsername: res.botUsername,
    }
    patch({
      integrations: existing
        ? state.integrations.map((i) => (i.id === existing.id ? row : i))
        : [...state.integrations, row],
    })
  },

  disconnectTelegram() {
    const biz = currentBusiness()
    if (!biz) return
    patch({
      integrations: state.integrations.map((i) =>
        i.businessId === biz.id && i.provider === 'telegram'
          ? { ...i, status: 'disconnected' }
          : i,
      ),
    })
  },

  async connectInstagram() {
    const biz = currentBusiness()
    if (!biz) return
    const res = await instagramService.connectOAuth()
    const existing = state.integrations.find(
      (i) => i.businessId === biz.id && i.provider === 'instagram',
    )
    const row: Integration = {
      id: existing?.id ?? uid('int'),
      businessId: biz.id,
      provider: 'instagram',
      status: res.status,
    }
    patch({
      integrations: existing
        ? state.integrations.map((i) => (i.id === existing.id ? row : i))
        : [...state.integrations, row],
    })
  },

  markNotificationsRead() {
    const id = state.sessionUserId
    if (!id) return
    patch({
      notifications: state.notifications.map((n) =>
        n.userId === id ? { ...n, read: true } : n,
      ),
    })
  },

  updateSettings(partial: Partial<Business>) {
    const biz = currentBusiness()
    if (!biz) return
    patch({
      businesses: state.businesses.map((b) => (b.id === biz.id ? { ...b, ...partial } : b)),
    })
  },

  createTicket(subject: string, body: string) {
    const profile = currentProfile()
    if (!profile) return
    patch({
      tickets: [
        {
          id: uid('tkt'),
          userId: profile.id,
          subject,
          body,
          status: 'open',
          createdAt: nowIso(),
        },
        ...state.tickets,
      ],
    })
  },

  adminSetPlan(businessId: string, plan: PlanCode) {
    const start = nowIso()
    patch({
      subscriptions: state.subscriptions.map((s) =>
        s.businessId === businessId
          ? { ...s, planCode: plan, startAt: start, endAt: addMonths(start, 1) }
          : s,
      ),
    })
  },

  adminSetLimits(plan: PlanCode, aiMessages: number) {
    // Demo: stored extra as synthetic pack override via extraCredits is not plan-wide.
    // We mutate CREDIT_PACKS copy in state for add-on prices; plan limits stay in config.
    void plan
    void aiMessages
  },

  adminSetPackPrice(packId: string, price: number) {
    patch({
      creditPackPrices: state.creditPackPrices.map((p) =>
        p.id === packId ? { ...p, price } : p,
      ),
    })
  },

  adminBonusDays(businessId: string, days: number) {
    patch({
      subscriptions: state.subscriptions.map((s) =>
        s.businessId === businessId
          ? { ...s, bonusDays: s.bonusDays + days, endAt: addDays(s.endAt, days) }
          : s,
      ),
    })
  },

  adminToggleBlock(userId: string) {
    patch({
      profiles: state.profiles.map((p) =>
        p.id === userId ? { ...p, blocked: !p.blocked } : p,
      ),
    })
  },

  adminTicket(id: string, status: SupportTicket['status']) {
    patch({
      tickets: state.tickets.map((t) => (t.id === id ? { ...t, status } : t)),
    })
  },

  addInvoice(invoice: Omit<Invoice, 'id' | 'businessId' | 'createdAt'>) {
    const biz = currentBusiness()
    if (!biz) throw new Error('Biznes yo‘q')
    const newInvoice: Invoice = {
      ...invoice,
      id: uid('inv'),
      businessId: biz.id,
      createdAt: nowIso(),
    }
    patch({ invoices: [newInvoice, ...state.invoices] })
    return newInvoice
  },

  updateInvoiceStatus(invoiceId: string, status: Invoice['status']) {
    patch({
      invoices: state.invoices.map((inv) =>
        inv.id === invoiceId ? { ...inv, status } : inv,
      ),
    })
  },

  addFollowup(followup: Omit<CollectionFollowup, 'id' | 'sentAt'>) {
    const newFollowup: CollectionFollowup = {
      ...followup,
      id: uid('fol'),
      sentAt: nowIso(),
    }
    patch({ followups: [newFollowup, ...state.followups] })
    return newFollowup
  },

  resetDemo() {
    state = createDemoState()
    emit()
  },
}

function formatItems(order: Order): string {
  return order.items.map((i) => `${i.productName} ×${i.quantity}`).join(', ')
}

export function usageFor(businessId: string) {
  const sub = state.subscriptions.find((s) => s.businessId === businessId)
  const used = state.aiUsed[businessId] ?? 0
  const extra = state.extraCredits[businessId] ?? 0
  const limit =
    (sub ? effectiveAiLimit(sub.planCode, sub.cycle) : PLAN_LIMITS.free.aiMessages) + extra
  return { used, limit, remaining: Math.max(0, limit - used), extra, plan: sub?.planCode ?? 'free' }
}

export { monthKey }
