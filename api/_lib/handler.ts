/**
 * The single request pipeline every route goes through:
 *
 *   CORS -> preflight -> method -> body/query validation -> auth -> tenant -> rate limit
 *
 * Responses are always JSON with `cache-control: no-store`, a request id and no
 * internal detail. Validation failures return only field paths and messages.
 */
import type { ZodType } from 'zod'
import { ApiError, logServerError, toPublicBody } from './errors.js'
import {
  applyCors,
  assertMethod,
  clientIp,
  handlePreflight,
  readJsonBody,
  requestId as makeRequestId,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from './http.js'
import { RATE_LIMITS, rateLimit } from './rate-limit.js'
import { requireUser, type AuthUser } from './auth.js'
import { requireOrgContext, type OrgContext } from './tenant.js'

export type RateLimitKind = keyof typeof RATE_LIMITS

export type HandlerResult = {
  status?: number
  body: unknown
  headers?: Record<string, string>
}

export type HandlerContext<B, Q> = {
  req: ApiRequest
  res: ApiResponse
  requestId: string
  ip: string
  method: string
  body: B
  query: Q
  user: AuthUser
  org: OrgContext
}

export type PublicHandlerContext<B, Q> = Omit<HandlerContext<B, Q>, 'user' | 'org'>

type BaseOptions<B, Q> = {
  methods: string[]
  bodySchema?: ZodType<B>
  querySchema?: ZodType<Q>
  rateLimit?: RateLimitKind
}

type AuthedOptions<B, Q> = BaseOptions<B, Q> & {
  handler: (ctx: HandlerContext<B, Q>) => Promise<HandlerResult> | HandlerResult
}

type PublicOptions<B, Q> = BaseOptions<B, Q> & {
  handler: (ctx: PublicHandlerContext<B, Q>) => Promise<HandlerResult> | HandlerResult
}

function normalizeQuery(req: ApiRequest): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (value === undefined) continue
    out[key] = Array.isArray(value) ? (value[0] ?? '') : value
  }
  return out
}

function parseOrThrow<T>(schema: ZodType<T> | undefined, value: unknown): T {
  if (!schema) return value as T
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 10).map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))
    throw new ApiError(422, 'validation_error', 'Request validation failed', {
      details: { issues },
    })
  }
  return parsed.data
}

function applyRateLimit(kind: RateLimitKind | undefined, key: string, reqId: string): void {
  if (!kind) return
  const config = RATE_LIMITS[kind]
  const result = rateLimit(`${kind}:${key}`, config.limit, config.windowMs)
  if (result.ok) return
  throw new ApiError(429, 'rate_limited', 'Too many requests, slow down', {
    headers: {
      'retry-after': String(result.retryAfterSeconds),
      'x-ratelimit-limit': String(result.limit),
      'x-ratelimit-remaining': '0',
      'x-request-id': reqId,
    },
  })
}

function requestedOrganizationId(
  body: unknown,
  query: unknown,
): string | undefined {
  const pick = (value: unknown): string | undefined => {
    if (!value || typeof value !== 'object') return undefined
    const candidate = (value as { organizationId?: unknown }).organizationId
    return typeof candidate === 'string' ? candidate : undefined
  }
  return pick(body) ?? pick(query)
}

function fail(req: ApiRequest, res: ApiResponse, reqId: string, err: unknown): void {
  const { status, body, headers } = toPublicBody(err, reqId)
  if (status >= 500) {
    logServerError(
      'request_failed',
      { requestId: reqId, method: req.method ?? null, path: req.url ?? null, status },
      err,
    )
  }
  sendJson(res, status, body, { 'x-request-id': reqId, ...(headers ?? {}) })
}

export function createHandler<B = unknown, Q = Record<string, string>>(
  options: AuthedOptions<B, Q>,
): (req: ApiRequest, res: ApiResponse) => Promise<void> {
  return async (req, res) => {
    const reqId = makeRequestId(req)
    try {
      applyCors(req, res)
      if (handlePreflight(req, res, reqId)) return

      const method = assertMethod(req, options.methods)
      // GET/DELETE carry no body, so the body schema is not applied to them
      // (otherwise a shared body schema would reject every list request).
      const body =
        method === 'GET' || method === 'DELETE'
          ? (undefined as B)
          : parseOrThrow(options.bodySchema, readJsonBody(req, reqId))
      const query = parseOrThrow(options.querySchema, normalizeQuery(req))
      const ip = clientIp(req)

      const user = await requireUser(req)
      const org = await requireOrgContext(user, requestedOrganizationId(body, query))

      applyRateLimit(options.rateLimit, `org:${org.organizationId || user.uid}`, reqId)

      const result = await options.handler({
        req,
        res,
        requestId: reqId,
        ip,
        method,
        body,
        query,
        user,
        org,
      })
      sendJson(res, result.status ?? 200, result.body, {
        'x-request-id': reqId,
        ...(result.headers ?? {}),
      })
    } catch (err) {
      fail(req, res, reqId, err)
    }
  }
}

export function createPublicHandler<B = unknown, Q = Record<string, string>>(
  options: PublicOptions<B, Q>,
): (req: ApiRequest, res: ApiResponse) => Promise<void> {
  return async (req, res) => {
    const reqId = makeRequestId(req)
    try {
      applyCors(req, res)
      if (handlePreflight(req, res, reqId)) return

      const method = assertMethod(req, options.methods)
      const body =
        method === 'GET' || method === 'DELETE'
          ? (undefined as B)
          : parseOrThrow(options.bodySchema, readJsonBody(req, reqId))
      const query = parseOrThrow(options.querySchema, normalizeQuery(req))
      const ip = clientIp(req)

      applyRateLimit(options.rateLimit, `ip:${ip}`, reqId)

      const result = await options.handler({
        req,
        res,
        requestId: reqId,
        ip,
        method,
        body,
        query,
      })
      sendJson(res, result.status ?? 200, result.body, {
        'x-request-id': reqId,
        ...(result.headers ?? {}),
      })
    } catch (err) {
      fail(req, res, reqId, err)
    }
  }
}
