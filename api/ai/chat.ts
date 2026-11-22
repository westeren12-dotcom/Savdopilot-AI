import { z } from 'zod'
import { assertDailyQuota, complete, recordAiInteraction, requireAiConfig, type ChatMessage } from '../_lib/ai.js'
import { createHandler } from '../_lib/handler.js'
import { aiChat, type AiChatInput } from '../_lib/validation.js'

const localeNames = { uz: 'Uzbek', ru: 'Russian', en: 'English' } as const

const replySchema = z.string().min(1).max(4000)

/**
 * POST /api/ai/chat — the sales assistant.
 *
 * The model, system prompt and business context are assembled server-side. A
 * client cannot choose the model, and its messages are capped by Zod.
 */
export default createHandler<unknown, Record<string, string>>({
  methods: ['POST'],
  bodySchema: aiChat,
  rateLimit: 'ai',
  handler: async ({ body, org }) => {
    const input = body as AiChatInput
    const config = requireAiConfig()
    await assertDailyQuota(org.organizationId)

    const locale = input.context?.locale ?? 'uz'
    const products = (input.context?.products ?? [])
      .map((product) => {
        const parts = [product.name]
        if (product.price !== undefined) parts.push(`${product.price}`)
        if (product.stock !== undefined) parts.push(`stock ${product.stock}`)
        if (product.description) parts.push(product.description)
        return `- ${parts.join(' | ')}`
      })
      .join('\n')

    const system = [
      'You are SavdoPilot, a practical sales assistant for small businesses in Uzbekistan.',
      `Reply in ${localeNames[locale]}. Be concise: at most 6 short sentences or a short list.`,
      'Use only the business context below. Never invent prices, stock or customer data.',
      'You cannot perform actions: describe what the owner should do instead.',
      input.context?.businessName ? `Business: ${input.context.businessName}` : '',
      products ? `Products:\n${products}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      ...input.messages.map((message) => ({ role: message.role, content: message.content })),
    ]

    const startedAt = Date.now()
    try {
      const result = await complete(config, messages, { maxTokens: 700, temperature: 0.5 })
      const reply = replySchema.parse(result.text)
      await recordAiInteraction({
        organizationId: org.organizationId,
        userId: org.userId,
        feature: 'chat',
        model: result.model,
        status: 'ok',
        latencyMs: Date.now() - startedAt,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      })
      return { body: { data: { reply } } }
    } catch (err) {
      await recordAiInteraction({
        organizationId: org.organizationId,
        userId: org.userId,
        feature: 'chat',
        model: config.model,
        status: 'error',
        latencyMs: Date.now() - startedAt,
      })
      throw err
    }
  },
})
