import { assertDailyQuota, complete, parseModelJson, recordAiInteraction, requireAiConfig } from '../_lib/ai.js'
import { ApiError } from '../_lib/errors.js'
import { createHandler } from '../_lib/handler.js'
import { aiInsights, aiOutputInsights, type AiInsightsInput } from '../_lib/validation.js'

const periodLabels = { '7d': 'the last 7 days', '30d': 'the last 30 days', '90d': 'the last 90 days' } as const

/**
 * POST /api/ai/insights — a short business read-out.
 *
 * The figure-crunching stays in the app; this endpoint only turns the metrics
 * the client already shows into prose. Output is validated as JSON and rejected
 * (`ai_invalid_output`) rather than passed through unchecked.
 */
export default createHandler<unknown, Record<string, string>>({
  methods: ['POST'],
  bodySchema: aiInsights,
  rateLimit: 'ai',
  handler: async ({ body, org }) => {
    const input = body as AiInsightsInput
    const config = requireAiConfig()
    await assertDailyQuota(org.organizationId)

    const metrics = input.metrics ?? {}
    const messages = [
      {
        role: 'system' as const,
        content: [
          'You analyse small-shop performance and reply with strict JSON only.',
          'Shape: {"summary": string, "highlights": string[], "risks": string[], "actions": string[]}',
          'summary: at most 3 sentences. Each list: 0-4 items, each under 160 characters.',
          'Use only the supplied numbers. Do not invent figures, trends or comparisons.',
          'If a metric is missing, say what is missing instead of guessing. Write in Uzbek.',
        ].join('\n'),
      },
      {
        role: 'user' as const,
        content: JSON.stringify({ period: periodLabels[input.period], metrics }),
      },
    ]

    const startedAt = Date.now()
    try {
      const result = await complete(config, messages, {
        maxTokens: 700,
        temperature: 0.3,
        json: true,
      })
      const parsed = aiOutputInsights.safeParse(parseModelJson(result.text))
      if (!parsed.success) {
        throw new ApiError(502, 'ai_invalid_output', 'AI returned an invalid response')
      }
      await recordAiInteraction({
        organizationId: org.organizationId,
        userId: org.userId,
        feature: 'insights',
        model: result.model,
        status: 'ok',
        latencyMs: Date.now() - startedAt,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      })
      return { body: { data: parsed.data } }
    } catch (err) {
      await recordAiInteraction({
        organizationId: org.organizationId,
        userId: org.userId,
        feature: 'insights',
        model: config.model,
        status: 'error',
        latencyMs: Date.now() - startedAt,
      })
      throw err
    }
  },
})
