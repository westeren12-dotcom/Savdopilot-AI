/**
 * Server-only configuration.
 *
 * SECURITY: this file must never be imported from `src/` (the Vite bundle).
 * It reads `process.env`, which does not exist in the browser, and some of the
 * values it exposes (service role key, provider secrets) must never ship to a
 * client. The Vite build only includes files reachable from `src/main.tsx`.
 */

function read(name: string): string | undefined {
  const raw = process.env[name]
  if (raw === undefined) return undefined
  const value = raw.trim()
  if (value === '') return undefined
  // .env.example placeholders must be treated as "not configured".
  if (value.startsWith('your-') || value === 'CHANGEME') return undefined
  return value
}

function list(name: string): string[] {
  const raw = read(name)
  if (!raw) return []
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function positiveInt(name: string, fallback: number): number {
  const raw = read(name)
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

/** Version reported by /api/health. Not a secret. */
export const apiVersion = (): string => read('APP_VERSION') ?? '1.0.0'

export const supabaseUrl = (): string | undefined =>
  read('SUPABASE_URL') ?? read('VITE_SUPABASE_URL')

/** Service role key — bypasses RLS. Server-side only. */
export const supabaseServiceRoleKey = (): string | undefined =>
  read('SUPABASE_SERVICE_ROLE_KEY')

/** Full service-account JSON (string, or base64-encoded string). */
export const firebaseServiceAccount = (): string | undefined =>
  read('FIREBASE_SERVICE_ACCOUNT')

export const aiProviderId = (): string => (read('AI_PROVIDER') ?? 'openai').toLowerCase()

export const aiModel = (): string => read('AI_MODEL') ?? 'gpt-4o-mini'

export const aiDailyLimitPerOrg = (): number => positiveInt('AI_DAILY_LIMIT_PER_ORG', 200)

export const corsAllowedOrigins = (): string[] => {
  const configured = list('ALLOWED_ORIGINS')
  if (configured.length) return configured
  const fallback = read('APP_URL') ?? read('VITE_APP_URL')
  return fallback ? [fallback] : []
}

export function isDatabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseServiceRoleKey())
}

export function isFirebaseAdminConfigured(): boolean {
  // Only a service account can mint credentials: the project id alone (which
  // VITE_FIREBASE_PROJECT_ID always provides) cannot sign or verify tokens.
  return Boolean(firebaseServiceAccount())
}

/**
 * Which AI credentials are usable. Returns null when no key is present so
 * endpoints can answer 503 instead of pretending to call a model.
 */
export function resolveAiConfig():
  | { provider: string; baseUrl: string; apiKey: string; model: string }
  | null {
  const provider = aiProviderId()

  if (provider === 'omniroute') {
    const key = read('OMNIROUTE_API_KEY')
    if (!key) return null
    return {
      provider,
      baseUrl: read('OMNIROUTE_API_BASE_URL') ?? 'https://api.omniroute.ai/v1',
      apiKey: key,
      model: aiModel(),
    }
  }

  const key = read('AI_API_KEY')
  if (!key) return null
  const defaults: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
  }
  return {
    provider,
    baseUrl:
      read('AI_API_BASE_URL') ??
      defaults[provider] ??
      'https://api.openai.com/v1',
    apiKey: key,
    model: aiModel(),
  }
}

/**
 * Payment credentials for one provider; `null` when the provider is not
 * configured. Only values the webhook actually uses are required here — asking
 * for a key we never read would make a working integration answer 503.
 */
export function paymentCredentials(provider: 'click' | 'payme' | 'uzum' | 'stripe'):
  | Record<string, string>
  | null {
  if (provider === 'click') {
    const serviceId = read('CLICK_SERVICE_ID')
    const secret = read('CLICK_SECRET_KEY')
    if (!serviceId || !secret) return null
    return { serviceId, secret }
  }
  if (provider === 'payme') {
    const key = read('PAYME_KEY')
    if (!key) return null
    return { key }
  }
  if (provider === 'uzum') {
    const secret = read('UZUM_SECRET_KEY')
    if (!secret) return null
    return { secret }
  }
  // Webhook signature verification only; the API never calls Stripe's REST API.
  const webhookSecret = read('STRIPE_WEBHOOK_SECRET')
  if (!webhookSecret) return null
  return { webhookSecret }
}
