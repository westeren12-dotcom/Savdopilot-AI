import { z } from 'zod'
import { assertDailyQuota, complete, recordAiInteraction, requireAiConfig } from '../_lib/ai'
import { createHandler } from '../_lib/handler'
import { aiReminder, type AiReminderInput } from '../_lib/validation'

const textSchema = z.string().min(1).max(1200)

/**
 * POST /api/ai/reminder — drafts an invoice reminder.
 * The amount and due date come from the validated request; the model only
 * words the message, and nothing is sent automatically.
 */
export default createHandler<unknown, Record<string, string>>({
  methods: ['POST'],
  bodySchema: aiReminder,
  rateLimit: 'ai',
  handler: async ({ body, org }) => {
    const input = body as AiReminderInput
    const config = requireAiConfig()
    await assertDailyQuota(org.organizationId)

    const messages = [
      {
        role: 'system' as const,
        content: [
          'You write payment reminders for a small business in Uzbekistan.',
          'Output only the message body, no subject, no markdown. Maximum 80 words.',
          `Tone: ${input.tone}. Firm but polite, never threatening.`,
          'Use exactly the invoice number, amount, currency and due date provided. Never change them.',
        ].join('\n'),
      },
      {
        role: 'user' as const,
        content: [
          `Customer: ${input.customerName}`,
          `Invoice: ${input.invoiceNumber}`,
          `Amount: ${input.amount} ${input.currency}`,
          `Due date: ${input.dueDate}`,
          `Days overdue: ${input.daysOverdue}`,
        ].join('\n'),
      },
    ]

    const startedAt = Date.now()
    try {
      const result = await complete(config, messages, { maxTokens: 400, temperature: 0.5 })
      const text = textSchema.parse(result.text)
      await recordAiInteraction({
        organizationId: org.organizationId,
        userId: org.userId,
        feature: 'reminder',
        model: result.model,
        status: 'ok',
        latencyMs: Date.now() - startedAt,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      })
      return { body: { data: { text } } }
    } catch (err) {
      await recordAiInteraction({
        organizationId: org.organizationId,
        userId: org.userId,
        feature: 'reminder',
        model: config.model,
        status: 'error',
        latencyMs: Date.now() - startedAt,
      })
      throw err
    }
  },
})
