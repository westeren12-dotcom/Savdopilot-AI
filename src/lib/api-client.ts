/**
 * Typed browser client for the Vercel Serverless API in `api/`.
 *
 * It never holds a server secret: the only credential is the Firebase ID token
 * of the signed-in user, attached per request. All business rules, tenant
 * scoping and AI calls live on the server.
 *
 * Nothing here is required by the current UI (the app still runs on its local
 * store); this is the seam the store can be migrated onto without touching
 * components.
 */
import { getFirebaseAuth } from '@/lib/firebase'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export type ApiRecord = Record<string, unknown>

export type ApiErrorBody = {
  error?: string
  code?: string
  requestId?: string
  details?: unknown
}

export class ApiClientError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId?: string
  readonly details?: unknown

  constructor(status: number, body: ApiErrorBody) {
    super(body.error || 'Request failed')
    this.name = 'ApiClientError'
    this.status = status
    this.code = body.code || 'internal_error'
    this.requestId = body.requestId
    this.details = body.details
  }
}

export type QueryValue = string | number | boolean | undefined | null

async function authHeaders(): Promise<Record<string, string>> {
  const auth = getFirebaseAuth()
  const user = auth?.currentUser
  if (!user) return {}
  const token = await user.getIdToken()
  return { authorization: `Bearer ${token}` }
}

function withQuery(path: string, query?: Record<string, QueryValue>): string {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

async function request<T>(
  method: string,
  path: string,
  options: {
    body?: unknown
    query?: Record<string, QueryValue>
    signal?: AbortSignal
  } = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  Object.assign(headers, await authHeaders())

  const response = await fetch(`${BASE_URL}${withQuery(path, options.query)}`, {
    method,
    headers,
    credentials: 'omit',
    cache: 'no-store',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  })

  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    throw new ApiClientError(response.status, (payload ?? {}) as ApiErrorBody)
  }
  return payload as T
}

export type SessionResponse = {
  user: { id: string; email: string | null; displayName: string | null; role: string }
  organization: { id: string; name: string; role: string }
  organizations: Array<{ id: string; name: string; role: string }>
}

export type OrgStatsResponse = {
  organization: { id: string; name: string; role: string }
  /** Aggregated counts only — never member identities. */
  users: { total: number; newLast7Days: number; newLast30Days: number }
  /** Platform-wide total, and only for a platform administrator. */
  organizations: { total: number } | null
}

export type Paginated<T> = {
  data: T[]
  pagination: { limit: number; offset: number; returned: number; hasMore: boolean }
}

export type AiChatPayload = {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  context?: {
    businessName?: string
    locale?: 'uz' | 'ru' | 'en'
    products?: Array<{ name: string; price?: number; stock?: number; description?: string }>
  }
}

export const api = {
  health: () =>
    request<{ status: string; checks: ApiRecord }>('GET', '/api/health'),

  session: () => request<SessionResponse>('POST', '/api/auth/session'),

  stats: () => request<OrgStatsResponse>('GET', '/api/stats'),

  customers: {
    list: (query?: { limit?: number; offset?: number }) =>
      request<Paginated<ApiRecord>>('GET', '/api/customers', { query }),
    create: (body: ApiRecord) => request<{ data: ApiRecord }>('POST', '/api/customers', { body }),
    get: (id: string) => request<{ data: ApiRecord }>('GET', `/api/customers/${id}`),
    update: (id: string, body: ApiRecord) =>
      request<{ data: ApiRecord }>('PATCH', `/api/customers/${id}`, { body }),
    remove: (id: string) =>
      request<{ data: { id: string; deleted: boolean } }>('DELETE', `/api/customers/${id}`),
  },

  sales: {
    list: (query?: { limit?: number; offset?: number }) =>
      request<Paginated<ApiRecord>>('GET', '/api/sales', { query }),
    create: (body: ApiRecord) => request<{ data: ApiRecord }>('POST', '/api/sales', { body }),
    get: (id: string) => request<{ data: ApiRecord }>('GET', `/api/sales/${id}`),
    update: (id: string, body: ApiRecord) =>
      request<{ data: ApiRecord }>('PATCH', `/api/sales/${id}`, { body }),
  },

  invoices: {
    list: (query?: { limit?: number; offset?: number }) =>
      request<Paginated<ApiRecord>>('GET', '/api/invoices', { query }),
    create: (body: ApiRecord) => request<{ data: ApiRecord }>('POST', '/api/invoices', { body }),
    get: (id: string) => request<{ data: ApiRecord & { items: ApiRecord[] } }>('GET', `/api/invoices/${id}`),
    update: (id: string, body: ApiRecord) =>
      request<{ data: ApiRecord }>('PATCH', `/api/invoices/${id}`, { body }),
  },

  ai: {
    chat: (body: AiChatPayload) =>
      request<{ data: { reply: string } }>('POST', '/api/ai/chat', { body }),
    message: (body: {
      customerName: string
      intent: 'follow_up' | 'order_confirmation' | 'thank_you' | 'promo' | 'payment_reminder'
      details?: string
      tone?: 'friendly' | 'formal' | 'short'
    }) => request<{ data: { text: string } }>('POST', '/api/ai/message', { body }),
    insights: (body: { period?: '7d' | '30d' | '90d'; metrics?: ApiRecord }) =>
      request<{
        data: { summary: string; highlights: string[]; risks: string[]; actions: string[] }
      }>('POST', '/api/ai/insights', { body }),
    reminder: (body: {
      invoiceNumber: string
      customerName: string
      amount: number
      currency?: string
      dueDate: string
      daysOverdue: number
      tone?: 'friendly' | 'formal' | 'short'
    }) => request<{ data: { text: string } }>('POST', '/api/ai/reminder', { body }),
  },
}
