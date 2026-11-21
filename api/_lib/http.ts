import { randomUUID } from 'node:crypto'
import { ApiError, badRequest, logServerInfo } from './errors'
import { corsAllowedOrigins } from './env'

/** Minimal structural type for a Vercel Node.js request (avoids @vercel/node). */
export interface ApiRequest {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
  body?: unknown
  socket?: { remoteAddress?: string }
  on?: (event: string, listener: (...args: never[]) => void) => void
}

export interface ApiResponse {
  statusCode: number
  setHeader(name: string, value: string): unknown
  end(chunk?: string): unknown
  writeHead(status: number, headers?: Record<string, string>): unknown
  json?: (body: unknown) => unknown
}

export const MAX_BODY_BYTES = 256 * 1024

export function header(req: ApiRequest, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()]
  if (Array.isArray(raw)) return raw[0]
  return raw
}

export function requestId(req: ApiRequest): string {
  const provided = header(req, 'x-request-id')
  if (provided && /^[A-Za-z0-9_-]{8,64}$/.test(provided)) return provided
  return randomUUID()
}

export function clientIp(req: ApiRequest): string {
  const forwarded = header(req, 'x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return header(req, 'x-real-ip') ?? req.socket?.remoteAddress ?? 'unknown'
}

export function sendJson(
  res: ApiResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  for (const [name, value] of Object.entries(extraHeaders)) res.setHeader(name, value)
  res.end(payload)
}

function isLocalOrigin(origin: string): boolean {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
}

export function isAllowedOrigin(origin: string): boolean {
  if (isLocalOrigin(origin)) return true
  return corsAllowedOrigins().includes(origin)
}

/**
 * Applies CORS headers. A foreign Origin is rejected outright (403) rather than
 * silently served, so a malicious site cannot use the browser as a proxy.
 */
export function applyCors(req: ApiRequest, res: ApiResponse): void {
  const origin = header(req, 'origin')
  res.setHeader('vary', 'Origin')
  if (!origin) return
  if (!isAllowedOrigin(origin)) {
    throw new ApiError(403, 'cors_rejected', 'Origin not allowed')
  }
  res.setHeader('access-control-allow-origin', origin)
  res.setHeader('access-control-allow-credentials', 'true')
  res.setHeader(
    'access-control-allow-headers',
    'authorization,content-type,x-request-id,x-signature,x-click-signature',
  )
  res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('access-control-max-age', '600')
}

export function handlePreflight(req: ApiRequest, res: ApiResponse, reqId: string): boolean {
  if ((req.method ?? 'GET').toUpperCase() !== 'OPTIONS') return false
  sendJson(res, 204, {}, { 'x-request-id': reqId })
  return true
}

function parseJsonString(raw: string, reqId: string): unknown {
  if (raw.length > MAX_BODY_BYTES) {
    throw new ApiError(413, 'payload_too_large', 'Request body is too large')
  }
  if (raw.trim() === '') return undefined
  try {
    return JSON.parse(raw)
  } catch {
    logServerInfo('body_parse_failed', { requestId: reqId })
    throw badRequest('Request body must be valid JSON')
  }
}

/** Parses the JSON body, enforcing a size cap. Returns undefined for an empty body. */
export function readJsonBody(req: ApiRequest, reqId: string): unknown {
  const body: unknown = req.body
  if (body === undefined || body === null) return undefined
  if (typeof body === 'string') return parseJsonString(body, reqId)
  if (Buffer.isBuffer(body)) return parseJsonString(body.toString('utf8'), reqId)
  if (typeof body === 'object') {
    // The platform has already parsed (and therefore not measured) this body;
    // cap it here too so MAX_BODY_BYTES holds on every path.
    let size: number
    try {
      size = Buffer.byteLength(JSON.stringify(body))
    } catch {
      throw badRequest('Unsupported request body')
    }
    if (size > MAX_BODY_BYTES) {
      throw new ApiError(413, 'payload_too_large', 'Request body is too large')
    }
    return body
  }
  throw badRequest('Unsupported request body')
}

/**
 * Raw body for webhook signature checks.
 *
 * Vercel may hand us an already-parsed object; in that case we re-serialise.
 * That is byte-identical only for compact JSON, so signature checks that depend
 * on exact bytes (Stripe) fail closed (400) instead of accepting an unverified
 * event. See BACKEND_SETUP.md -> "Webhook raw body".
 */
export async function readRawBody(req: ApiRequest): Promise<Buffer | null> {
  const body: unknown = req.body
  if (typeof body === 'string') return Buffer.from(body, 'utf8')
  if (Buffer.isBuffer(body)) return body
  if (body && typeof body === 'object') return Buffer.from(JSON.stringify(body), 'utf8')
  if (!req.on) return null

  return new Promise<Buffer | null>((resolve) => {
    const chunks: Buffer[] = []
    let size = 0
    let settled = false
    const done = (value: Buffer | null) => {
      if (!settled) {
        settled = true
        resolve(value)
      }
    }
    const timer = setTimeout(() => done(null), 2000)
    req.on?.('data', ((chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        clearTimeout(timer)
        done(null)
        return
      }
      chunks.push(chunk)
    }) as never)
    req.on?.('end', (() => {
      clearTimeout(timer)
      done(Buffer.concat(chunks))
    }) as never)
    req.on?.('error', (() => {
      clearTimeout(timer)
      done(null)
    }) as never)
  })
}

/** Only these methods are ever accepted; anything else is 405. */
export function assertMethod(req: ApiRequest, allowed: string[]): string {
  const method = (req.method ?? 'GET').toUpperCase()
  if (!allowed.includes(method)) {
    throw new ApiError(405, 'method_not_allowed', `Method ${method} not allowed`, {
      headers: { allow: allowed.join(', ') },
    })
  }
  return method
}
