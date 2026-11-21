/**
 * AI provider access.
 *
 * The browser never talks to a model provider and never holds a key. Every call
 * happens here, with:
 *   - a server-configured provider/model (no model id from the client),
 *   - a per-organization daily quota,
 *   - a request timeout,
 *   - validated input (Zod, in validation.ts) and validated output (per route),
 *   - usage recorded in `ai_interactions`.
 *
 * With no credentials this module throws 503 `ai_not_configured` instead of
 * attempting a paid request.
 */
import { ApiError, logServerError } from './errors'
import { aiDailyLimitPerOrg, resolveAiConfig } from './env'
import { getDb } from './supabase'

export type AiConfig = NonNullable<ReturnType<typeof resolveAiConfig>>
export type AiFeature = 'chat' | 'message' | 'insights' | 'reminder'
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type AiCompletion = {
  text: string
  model: string
  tokensIn: number
  tokensOut: number
}

const TIMEOUT_MS = 25_000

export function requireAiConfig(): AiConfig {
  const config = resolveAiConfig()
  if (!config) {
    throw new ApiError(503, 'ai_not_configured', 'AI is not configured')
  }
  return config
}

/** Counts today's attempts (UTC) for the organization. */
export async function assertDailyQuota(organizationId: string): Promise<void> {
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  try {
    const { count, error } = await getDb()
      .from('ai_interactions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('created_at', since.toISOString())

    if (error) {
      // A quota check failure must not take the feature down; the per-minute
      // rate limit still applies. The failure is visible in the logs.
      logServerError('ai_quota_check_failed', { organizationId }, new Error(error.message))
      return
    }
    if ((count ?? 0) >= aiDailyLimitPerOrg()) {
      throw new ApiError(429, 'rate_limited', 'Daily AI limit reached for this organization')
    }
  } catch (err) {
    if (err instanceof ApiError) throw err
    logServerError('ai_quota_check_failed', { organizationId }, err)
  }
}

function pickString(source: unknown): string | null {
  if (!source || typeof source !== 'object') return null
  const content = (source as { content?: unknown }).content
  return typeof content === 'string' && content.trim() ? content : null
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  payload: unknown,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const json: unknown = await response.json().catch(() => null)
    return { ok: response.ok, status: response.status, json }
  } finally {
    clearTimeout(timer)
  }
}

/** Calls the configured provider and returns the assistant text. */
export async function complete(
  config: AiConfig,
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number; json?: boolean } = {},
): Promise<AiCompletion> {
  const maxTokens = options.maxTokens ?? 800
  const temperature = options.temperature ?? 0.4

  if (config.provider === 'anthropic') {
    const system = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n')
    const conversation = messages.filter((message) => message.role !== 'system')

    let result: { ok: boolean; status: number; json: unknown }
    try {
      result = await postJson(
        `${config.baseUrl}/messages`,
        {
          'content-type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        {
          model: config.model,
          max_tokens: maxTokens,
          temperature,
          ...(system ? { system } : {}),
          messages: conversation,
        },
      )
    } catch (err) {
      logServerError('ai_request_failed', { provider: config.provider }, err)
      throw new ApiError(502, 'ai_upstream_error', 'AI provider request failed')
    }

    if (!result.ok) {
      logServerError('ai_upstream_status', { provider: config.provider, status: result.status }, new Error('provider error'))
      throw new ApiError(502, 'ai_upstream_error', 'AI provider request failed')
    }

    const body = result.json as {
      content?: Array<{ type?: string; text?: string }>
      usage?: { input_tokens?: number; output_tokens?: number }
    }
    const text = (body?.content ?? [])
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text as string)
      .join('\n')
      .trim()

    if (!text) throw new ApiError(502, 'ai_invalid_output', 'AI returned an empty response')
    return {
      text,
      model: config.model,
      tokensIn: Number(body?.usage?.input_tokens ?? 0),
      tokensOut: Number(body?.usage?.output_tokens ?? 0),
    }
  }

  // OpenAI-compatible Chat Completions (OpenAI, OmniRoute, compatible gateways).
  let result: { ok: boolean; status: number; json: unknown }
  try {
    result = await postJson(
      `${config.baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      {
        model: config.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(options.json ? { response_format: { type: 'json_object' } } : {}),
      },
    )
  } catch (err) {
    logServerError('ai_request_failed', { provider: config.provider }, err)
    throw new ApiError(502, 'ai_upstream_error', 'AI provider request failed')
  }

  if (!result.ok) {
    logServerError('ai_upstream_status', { provider: config.provider, status: result.status }, new Error('provider error'))
    throw new ApiError(502, 'ai_upstream_error', 'AI provider request failed')
  }

  const body = result.json as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const text = pickString(body?.choices?.[0]?.message)
  if (!text) throw new ApiError(502, 'ai_invalid_output', 'AI returned an empty response')

  return {
    text: text.trim(),
    model: config.model,
    tokensIn: Number(body?.usage?.prompt_tokens ?? 0),
    tokensOut: Number(body?.usage?.completion_tokens ?? 0),
  }
}

/** Parses JSON defensively: models sometimes wrap JSON in markdown fences. */
export function parseModelJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new ApiError(502, 'ai_invalid_output', 'AI returned an invalid response')
  }
}

/** Best-effort usage logging; a logging failure never fails the user request. */
export async function recordAiInteraction(input: {
  organizationId: string
  userId: string
  feature: AiFeature
  model: string
  status: 'ok' | 'error'
  latencyMs: number
  tokensIn?: number
  tokensOut?: number
}): Promise<void> {
  try {
    const { error } = await getDb().from('ai_interactions').insert({
      organization_id: input.organizationId,
      user_id: input.userId || null,
      feature: input.feature,
      model: input.model,
      status: input.status,
      latency_ms: input.latencyMs,
      input_tokens: input.tokensIn ?? 0,
      output_tokens: input.tokensOut ?? 0,
    })
    if (error) {
      logServerError('ai_usage_log_failed', { feature: input.feature }, new Error(error.message))
    }
  } catch (err) {
    logServerError('ai_usage_log_failed', { feature: input.feature }, err)
  }
}
