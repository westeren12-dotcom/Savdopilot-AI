import assert from 'node:assert/strict'
import test from 'node:test'
import health from '../../api/health'
import customers from '../../api/customers'

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
    method: 'GET',
    url: '/api/health',
    headers: {} as Record<string, string>,
    query: {},
    socket: { remoteAddress: '10.0.0.1' },
    ...overrides,
  }
}

test('GET /api/health answers 200 with configuration flags and no secrets', async () => {
  const res = makeRes()
  await health(makeReq() as never, res as never)

  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['cache-control'], 'no-store')

  const body = res.payload as {
    status: string
    service: string
    checks: { database: string; auth: string; ai: string; payments: Record<string, boolean> }
  }
  assert.equal(body.status, 'ok')
  assert.equal(body.service, 'savdopilot-api')
  assert.ok(
    ['ok', 'not_configured', 'invalid_url', 'unreachable'].includes(body.checks.database),
  )
  assert.ok(
    ['configured', 'not_configured', 'invalid', 'misconfigured'].includes(body.checks.auth),
  )
  assert.ok(['configured', 'not_configured'].includes(body.checks.ai))

  const serialized = JSON.stringify(res.payload)
  for (const secret of [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.FIREBASE_SERVICE_ACCOUNT,
    process.env.AI_API_KEY,
    process.env.STRIPE_SECRET_KEY,
    process.env.CLICK_SECRET_KEY,
  ]) {
    if (secret && secret.length > 8) {
      assert.ok(!serialized.includes(secret), 'health response must never contain a secret')
    }
  }
})

test('a protected route without configuration fails closed with 503, not a bypass', async () => {
  const res = makeRes()
  const req = makeReq({
    method: 'GET',
    url: '/api/customers',
    headers: { authorization: 'Bearer not-a-real-firebase-token' },
  })
  // Either auth or database may be the first missing piece depending on the
  // environment; both must answer 5xx-with-code instead of serving data.
  await customers(req as never, res as never)
  assert.ok(res.statusCode >= 500 || res.statusCode === 401, `unexpected ${res.statusCode}`)
  assert.ok('code' in (res.payload as object))
})

test('a POST to a protected route without a token is rejected with 401', async () => {
  const res = makeRes()
  await customers(makeReq({ method: 'POST', url: '/api/customers', body: { name: 'x' } }) as never, res as never)
  if (process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    assert.equal(res.statusCode, 401)
  } else {
    assert.ok([401, 503].includes(res.statusCode))
  }
})
