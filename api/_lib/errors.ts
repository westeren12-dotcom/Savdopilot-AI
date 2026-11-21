/**
 * Every failure that leaves the API goes through ApiError -> toPublicBody.
 * Internal errors (SQL text, provider messages, stack traces) are logged
 * server-side only and replaced with a generic message for the client.
 */

export type ErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'method_not_allowed'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'validation_error'
  | 'conflict'
  | 'rate_limited'
  | 'cors_rejected'
  | 'auth_not_configured'
  | 'database_not_configured'
  | 'ai_not_configured'
  | 'ai_upstream_error'
  | 'ai_invalid_output'
  | 'payment_not_configured'
  | 'payment_signature_invalid'
  | 'payment_state_conflict'
  | 'internal_error'

export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode
  readonly details?: unknown
  readonly headers?: Record<string, string>

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    options?: { details?: unknown; headers?: Record<string, string> },
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = options?.details
    this.headers = options?.headers
  }
}

export const badRequest = (message = 'Malformed request') =>
  new ApiError(400, 'bad_request', message)

export const unauthorized = (message = 'Authentication required') =>
  new ApiError(401, 'unauthorized', message, {
    headers: { 'www-authenticate': 'Bearer realm="savdopilot"' },
  })

export const forbidden = (message = 'Not allowed') =>
  new ApiError(403, 'forbidden', message)

/** Tenant isolation: a resource in another organization is indistinguishable from a missing one. */
export const notFound = (message = 'Resource not found') =>
  new ApiError(404, 'not_found', message)

export type PublicBody = {
  error: string
  code: ErrorCode
  requestId: string
  details?: unknown
}

export function toPublicBody(
  err: unknown,
  requestId: string,
): { status: number; body: PublicBody; headers?: Record<string, string> } {
  if (err instanceof ApiError) {
    return {
      status: err.status,
      headers: err.headers,
      body: {
        error: err.message,
        code: err.code,
        requestId,
        ...(err.details === undefined ? {} : { details: err.details }),
      },
    }
  }
  return {
    status: 500,
    body: {
      error: 'Internal server error',
      code: 'internal_error',
      requestId,
    },
  }
}

/**
 * Structured server-side logging. Never logs request bodies, tokens, keys or
 * SQL payloads — only metadata needed to debug.
 */
export function logServerError(event: string, meta: Record<string, unknown>, err: unknown): void {
  const detail =
    err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : { value: String(err) }
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ level: 'error', event, ...meta, ...detail }))
}

export function logServerInfo(event: string, meta: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.info(JSON.stringify({ level: 'info', event, ...meta }))
}
