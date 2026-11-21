import { z } from 'zod'

/**
 * Every schema is strict: unknown keys are rejected instead of silently
 * forwarded. That is what prevents mass assignment (e.g. a client sending
 * `organization_id` or `status: "paid"` on an invoice update).
 */

const id = z.uuid()
const isoDate = z
  .string()
  .min(4)
  .max(40)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Must be an ISO date')
const shortText = (max: number) => z.string().trim().min(1).max(max)
const money = z.number().finite().min(0).max(1_000_000_000_000)

export const organizationQuery = z.strictObject({
  organizationId: id.optional(),
})

export const paginationQuery = z.strictObject({
  organizationId: id.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
})

export const customerStatus = z.enum(['new', 'active', 'vip', 'inactive'])

export const customerCreate = z.strictObject({
  organizationId: id.optional(),
  name: shortText(120),
  phone: z.string().trim().max(32).optional(),
  email: z.email().max(200).optional(),
  status: customerStatus.default('new'),
  notes: z.string().max(2000).optional(),
  telegram: z.string().trim().max(80).optional(),
  instagram: z.string().trim().max(80).optional(),
})

export const customerUpdate = z
  .strictObject({
    name: shortText(120).optional(),
    phone: z.string().trim().max(32).nullable().optional(),
    email: z.email().max(200).nullable().optional(),
    status: customerStatus.optional(),
    notes: z.string().max(2000).nullable().optional(),
    telegram: z.string().trim().max(80).nullable().optional(),
    instagram: z.string().trim().max(80).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')

export const leadStatus = z.enum(['new', 'contacted', 'qualified', 'won', 'lost'])

export const leadCreate = z.strictObject({
  organizationId: id.optional(),
  name: shortText(120),
  phone: z.string().trim().max(32).optional(),
  email: z.email().max(200).optional(),
  source: z.enum(['manual', 'telegram', 'instagram', 'web', 'ai']).default('manual'),
  status: leadStatus.default('new'),
  notes: z.string().max(2000).optional(),
})

const saleItem = z.strictObject({
  description: shortText(200),
  quantity: z.number().int().min(1).max(100_000),
  unitPrice: money,
})

export const saleCreate = z.strictObject({
  organizationId: id.optional(),
  customerId: id.optional(),
  currency: z.string().trim().length(3).default('UZS'),
  notes: z.string().max(2000).optional(),
  soldAt: isoDate.optional(),
  items: z.array(saleItem).min(1).max(50),
})

export const saleStatus = z.enum(['draft', 'completed', 'cancelled'])

export const saleUpdate = z
  .strictObject({
    status: saleStatus.optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')

const invoiceItem = z.strictObject({
  description: shortText(200),
  quantity: z.number().finite().positive().max(100_000),
  unitPrice: money,
})

export const invoiceStatus = z.enum(['draft', 'sent', 'overdue', 'partial'])

export const invoiceCreate = z.strictObject({
  organizationId: id.optional(),
  customerId: id,
  number: z.string().trim().min(1).max(64).optional(),
  currency: z.string().trim().length(3).default('UZS'),
  issueDate: isoDate.optional(),
  dueDate: isoDate,
  notes: z.string().max(2000).optional(),
  items: z.array(invoiceItem).min(1).max(50),
})

/**
 * `paid` is deliberately absent: an invoice becomes paid only through a
 * verified payment callback, never through a client request.
 */
export const invoiceUpdate = z
  .strictObject({
    status: invoiceStatus.optional(),
    dueDate: isoDate.optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')

export const aiRole = z.enum(['user', 'assistant'])

export const aiChat = z.strictObject({
  organizationId: id.optional(),
  messages: z
    .array(z.strictObject({ role: aiRole, content: z.string().min(1).max(4000) }))
    .min(1)
    .max(20),
  context: z
    .strictObject({
      businessName: z.string().max(120).optional(),
      locale: z.enum(['uz', 'ru', 'en']).default('uz'),
      products: z
        .array(
          z.strictObject({
            name: z.string().max(120),
            price: money.optional(),
            stock: z.number().int().min(0).max(1_000_000).optional(),
            description: z.string().max(300).optional(),
          }),
        )
        .max(50)
        .optional(),
    })
    .optional(),
})

export const aiMessageIntent = z.enum([
  'follow_up',
  'order_confirmation',
  'thank_you',
  'promo',
  'payment_reminder',
])

export const aiMessage = z.strictObject({
  organizationId: id.optional(),
  customerName: shortText(120),
  intent: aiMessageIntent,
  details: z.string().max(1000).optional(),
  tone: z.enum(['friendly', 'formal', 'short']).default('friendly'),
})

export const aiInsights = z.strictObject({
  organizationId: id.optional(),
  period: z.enum(['7d', '30d', '90d']).default('30d'),
  metrics: z
    .strictObject({
      revenue: money.optional(),
      orders: z.number().int().min(0).optional(),
      newCustomers: z.number().int().min(0).optional(),
      topProducts: z.array(z.string().max(120)).max(10).optional(),
    })
    .optional(),
})

export const aiReminder = z.strictObject({
  organizationId: id.optional(),
  invoiceNumber: shortText(64),
  customerName: shortText(120),
  amount: money,
  currency: z.string().trim().length(3).default('UZS'),
  dueDate: isoDate,
  daysOverdue: z.number().int().min(0).max(3650),
  tone: z.enum(['friendly', 'formal', 'short']).default('friendly'),
})

export const aiOutputText = z.strictObject({
  text: z.string().min(1).max(4000),
})

export const aiOutputInsights = z.strictObject({
  summary: z.string().min(1).max(2000),
  highlights: z.array(z.string().max(300)).max(10).default([]),
  risks: z.array(z.string().max(300)).max(10).default([]),
  actions: z.array(z.string().max(300)).max(10).default([]),
})

export type CustomerCreateInput = z.infer<typeof customerCreate>
export type CustomerUpdateInput = z.infer<typeof customerUpdate>
export type SaleCreateInput = z.infer<typeof saleCreate>
export type InvoiceCreateInput = z.infer<typeof invoiceCreate>
export type AiChatInput = z.infer<typeof aiChat>
export type AiMessageInput = z.infer<typeof aiMessage>
export type AiInsightsInput = z.infer<typeof aiInsights>
export type AiReminderInput = z.infer<typeof aiReminder>
