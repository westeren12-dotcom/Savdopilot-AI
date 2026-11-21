import { z } from 'zod'
import { assertDailyQuota, complete, recordAiInteraction, requireAiConfig } from '../_lib/ai'
import { createHandler } from '../_lib/handler'
import { aiMessage, type AiMessageInput } from '../_lib/validation'

const textSchema = z.string().min(1).max(1200)

const intents: Record<AiMessageInput['intent'], string> = {
  follow_up: 'follow up with a customer who has not replied',
  order_confirmation: 'confirm an order and its next step',
  thank_you: 'thank a customer after a purchase',
  promo: 'announce a promotion without inventing discounts',
  payment_reminder: 'politely remind about an unpaid balance',
}

/**
 * POST /api/ai/message — drafts a customer-facing message.
 * Output is text the owner copies/sends themselves; nothing is sent from here.
 */
export default createHandler<unknown, Record<string, string>>({
  methods: ['POST'],
  bodySchema: aiMessage,
  rateLimit: 'ai',
  handler: async ({ body, org }) => {
    const input = body as AiMessageInput
    const config = requireAiConfig()
    await assertDailyQuota(org.organizationId)

    const messages = [
      {
        role: 'system' as const,
        content: [
          'You write short business messages for a shop in Uzbekistan.',
          'Output only the message body: no subject line, no quotes, no markdown headings.',
          `Tone: ${input.tone}. Maximum 90 words.`,
          'Never invent discounts, deadlines, prices or promises that were not given.',
          'Write in Uzbek unless the customer details clearly indicate Russian.',
        ].join('\n'),
      },
      {
        role: 'user' as const,
        content: [
          `Customer: ${input.customerName}`,
          `Goal: ${intents[input.intent]}`,
          input.details ? `Details: ${input.details}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ]

    const startedAt = Date.now()
    try {
      const result = await complete(config, messages, { maxTokens: 400, temperature: 0.6 })
      const text = textSchema.parse(result.text)
      await recordAiInteraction({
        organizationId: org.organizationId,
        userId: org.userId,
        feature: 'message',
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
        feature: 'message',
        model: config.model,
        status: 'error',
        latencyMs: Date.now() - startedAt,
      })
      throw err
    }
  },
})
