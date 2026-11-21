import assert from 'node:assert/strict'
import test from 'node:test'
import { createHandler, createPublicHandler } from '../../api/_lib/handler'
import { ApiError, toPublicBody } from '../../api/_lib/errors'
import { rateLimit, resetRateLimits, RATE_LIMITS } from '../../api/_lib/rate-limit'

type FakeResponse = {
  statusCode: number
  headers: Record<string, string>
  payload: unknown
  setHeader(name: string, value: string): void
  end(chunk?: string): void
}

function makeRes(): FakeResponse {
  return {
    statusCode: 0,
    headers: {},
    payload: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    end(chunk) {
      this.payload = chunk ? JSON.parse(chunk) : undefined
    },
  }
}

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    method: 'POST',
    url: '/api/test',
    headers: {} as Record<string, string>,
    query: {},
    body: undefined,
    socket: { remoteAddress: '10.0.0.1' },
    ...overrides,
  }
}

const authedHandler = createHandler<{ name?: string }, Record<string, string>>({
  methods: ['POST'],
  bodySchema: undefined,
  handler: async () => ({ body: { ok: true } }),
})

test('preflight from a localhost origin is answered with 204', async () => {
  const res = makeRes()
  await authedHandler(
    makeReq({ method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } }) as never,
    res as never,
  )
  assert.equal(res.statusCode, 204)
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173')
})

test('a foreign origin is rejected with 403 cors_rejected', async () => {
  const res = makeRes()
  await authedHandler(
    makeReq({ headers: { origin: 'https://evil.example' } }) as never,
    res as never,
  )
  assert.equal(res.statusCode, 403)
  assert.equal((res.payload as { code: string }).code, 'cors_rejected')
})

test('an unsupported method is rejected with 405 and an Allow header', async () => {
  const res = makeRes()
  await authedHandler(makeReq({ method: 'DELETE' }) as never, res as never)
  assert.equal(res.statusCode, 405)
  assert.equal(res.headers['allow'], 'POST')
})

test('a request without a bearer token is rejected with 401 before any lookup', async () => {
  const res = makeRes()
  await authedHandler(makeReq() as never, res as never)
  assert.equal(res.statusCode, 401)
  assert.equal((res.payload as { code: string }).code, 'unauthorized')
  assert.equal(res.headers['www-authenticate'], 'Bearer realm="savdopilot"')
})

test('a malformed bearer header is rejected', async () => {
  const res = makeRes()
  await authedHandler(
    makeReq({ headers: { authorization: 'Token abc' } }) as never,
    res as never,
  )
  assert.equal(res.statusCode, 401)
})

test('public handler validates the body with 422 and does not echo values', async () => {
  const { z } = await import('zod')
  const handler = createPublicHandler({
    methods: ['POST'],
    bodySchema: z.strictObject({ count: z.number().int().min(1) }),
    handler: async ({ body }) => ({ body: { count: (body as { count: number }).count } }),
  })

  const res = makeRes()
  await handler(makeReq({ body: { count: 'secret-value' } }) as never, res as never)
  assert.equal(res.statusCode, 422)
  const body = res.payload as { code: string; details: { issues: Array<{ path: string }> } }
  assert.equal(body.code, 'validation_error')
  assert.equal(body.details.issues[0]?.path, 'count')
  assert.ok(!JSON.stringify(body).includes('secret-value'))
})

test('valid public request returns JSON with no-store', async () => {
  const { z } = await import('zod')
  const handler = createPublicHandler({
    methods: ['POST'],
    bodySchema: z.strictObject({ count: z.number().int() }),
    handler: async ({ body }) => ({ body: { count: (body as { count: number }).count } }),
  })
  const res = makeRes()
  await handler(makeReq({ body: { count: 2 } }) as never, res as never)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.payload, { count: 2 })
  assert.equal(res.headers['cache-control'], 'no-store')
  assert.ok(res.headers['x-request-id'])
})

test('unexpected errors become a generic 500 with no internal detail', () => {
  const { status, body } = toPublicBody(new Error('postgres://user:pass@host'), 'req-1')
  assert.equal(status, 500)
  assert.equal(body.error, 'Internal server error')
  assert.ok(!JSON.stringify(body).includes('postgres'))
})

test('ApiError keeps its status, code and safe message', () => {
  const { status, body } = toPublicBody(new ApiError(404, 'not_found', 'Customer not found'), 'r2')
  assert.equal(status, 404)
  assert.equal(body.code, 'not_found')
  assert.equal(body.error, 'Customer not found')
})

test('a GET request is not validated against the POST body schema', async () => {
  const { z } = await import('zod')
  const handler = createPublicHandler<unknown, Record<string, string>>({
    methods: ['GET', 'POST'],
    bodySchema: z.strictObject({ name: z.string().min(1) }),
    querySchema: z.strictObject({ limit: z.coerce.number().int().default(25) }),
    handler: async ({ method, query }) => ({ body: { method, limit: query.limit } }),
  })
  const res = makeRes()
  await handler(makeReq({ method: 'GET' }) as never, res as never)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.payload, { method: 'GET', limit: 25 })
})

test('rate limiting blocks after the limit inside one window', () => {
  resetRateLimits()
  const { limit, windowMs } = RATE_LIMITS.data
  for (let i = 0; i < limit; i += 1) {
    assert.equal(rateLimit('test-key', limit, windowMs).ok, true)
  }
  const blocked = rateLimit('test-key', limit, windowMs)
  assert.equal(blocked.ok, false)
  assert.equal(blocked.remaining, 0)
  assert.equal(rateLimit('other-key', limit, windowMs).ok, true)
})
