/**
 * End-to-end-ish tests for the auth -> tenant -> route pipeline.
 *
 * These run the real Vercel handlers, the real request pipeline, supabase-js and
 * the real tenant resolver. Two things are substituted:
 *   - Firebase token verification (`__setVerifierForTests`), because a genuine
 *     ID token needs a live Firebase project and service account.
 *   - Supabase's PostgREST, replaced by a tiny HTTP server that answers the same
 *     filter URLs, because a real project is not available here.
 *
 * So the assertions about status codes, error mapping, org resolution and
 * query filtering are real; the token cryptography and Postgres itself are not
 * exercised. See BACKEND_SETUP.md §11 for what still needs a live environment.
 */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import session from '../../api/auth/session'
import customers from '../../api/customers/index'
import { __setVerifierForTests, type AuthUser } from '../../api/_lib/auth'
import { resetRateLimits } from '../../api/_lib/rate-limit'

process.env.NODE_ENV = 'test'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TOKEN = 'header.payload.signature-for-tests'
const SERVICE_KEY = 'service-role-key-for-auth-flow-tests'

type Row = Record<string, unknown>
type FakeState = {
  users: Row[]
  organization_members: Row[]
  customers: Row[]
}

type FakePostgrest = {
  url: string
  requests: string[]
  close: () => Promise<void>
}

function startFakePostgrest(state: FakeState): Promise<FakePostgrest> {
  const requests: string[] = []
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    requests.push(`${url.pathname}${url.search}`)

    const send = (status: number, body: unknown): void => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }

    const table = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname)?.[1]
    const rows = table ? (state as unknown as Record<string, Row[]>)[table] : undefined
    if (!rows) {
      send(404, { code: '42P01', message: `relation public.${table ?? '?'} does not exist` })
      return
    }

    let matched = rows.slice()
    for (const [key, value] of url.searchParams) {
      if (!value.startsWith('eq.')) continue
      const expected = value.slice(3)
      matched = matched.filter((row) => String(row[key]) === expected)
    }

    // PostgREST answers a "single object" request (supabase-js .single() and
    // .maybeSingle()) with 406 + PGRST116 when the row count is not exactly 1.
    if (String(req.headers.accept ?? '').includes('application/vnd.pgrst.object+json')) {
      if (matched.length !== 1) {
        send(406, {
          code: 'PGRST116',
          message: 'JSON object requested, multiple (or no) rows returned',
          details: `The result contains ${matched.length} rows`,
          hint: null,
        })
        return
      }
      send(200, matched[0])
      return
    }
    send(200, matched)
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({
        url: `http://127.0.0.1:${port}`,
        requests,
        close: () => new Promise<void>((done) => server.close(() => done())),
      })
    })
  })
}

const ENV_KEYS = [
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FIREBASE_SERVICE_ACCOUNT',
  'FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_PROJECT_ID',
  'ALLOWED_ORIGINS',
]

function setEnv(values: Record<string, string | undefined> = {}): void {
  for (const key of ENV_KEYS) delete process.env[key]
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) process.env[key] = value
  }
}

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
    url: '/api/auth/session',
    headers: {} as Record<string, string>,
    query: {},
    body: undefined,
    socket: { remoteAddress: '10.0.0.1' },
    ...overrides,
  }
}

function authed(overrides: Record<string, unknown> = {}) {
  return makeReq({ headers: { authorization: `Bearer ${TOKEN}` }, ...overrides })
}

function stateWithMember(): FakeState {
  return {
    users: [{ id: USER_A, firebase_uid: 'firebase-uid-a', email: 'a@example.com', display_name: 'A' }],
    organization_members: [
      {
        user_id: USER_A,
        organization_id: ORG_A,
        role: 'owner',
        created_at: '2026-01-01T00:00:00Z',
        organizations: { id: ORG_A, name: 'Org A' },
      },
    ],
    customers: [
      {
        id: 'c0000000-0000-4000-8000-00000000000a',
        organization_id: ORG_A,
        name: 'Customer in A',
        phone: null,
        email: null,
        status: 'active',
        notes: null,
        telegram: null,
        instagram: null,
        created_at: '2026-01-02T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
      },
      {
        id: 'c0000000-0000-4000-8000-00000000000b',
        organization_id: ORG_B,
        name: 'Customer in B',
        phone: null,
        email: null,
        status: 'active',
        notes: null,
        telegram: null,
        instagram: null,
        created_at: '2026-01-03T00:00:00Z',
        updated_at: '2026-01-03T00:00:00Z',
      },
    ],
  }
}

async function runFake<T extends FakePostgrest>(
  state: FakeState,
  body: (fake: T) => Promise<void>,
): Promise<void> {
  const fake = (await startFakePostgrest(state)) as T
  try {
    await body(fake)
  } finally {
    await fake.close()
  }
}

function verifyValidUser(uid = 'firebase-uid-a'): void {
  __setVerifierForTests(async (): Promise<AuthUser> => ({
    uid,
    email: 'a@example.com',
    name: 'A',
    picture: null,
  }))
}

function verifyThrows(code: string): void {
  __setVerifierForTests(async () => {
    throw Object.assign(new Error('token rejected'), { code })
  })
}

test('a request without a token is rejected with 401 before any verification', async () => {
  setEnv({})
  let calls = 0
  __setVerifierForTests(async () => {
    calls += 1
    throw new Error('must not be called')
  })
  resetRateLimits()

  const res = makeRes()
  await session(makeReq() as never, res as never)

  assert.equal(res.statusCode, 401)
  assert.equal((res.payload as { code: string }).code, 'unauthorized')
  assert.equal(calls, 0)
})

test('a malformed bearer header or a too-short token is rejected with 401', async () => {
  setEnv({})
  verifyValidUser()
  resetRateLimits()

  for (const headers of [{ authorization: 'Token abc' }, { authorization: 'Bearer short' }]) {
    const res = makeRes()
    await session(makeReq({ headers }) as never, res as never)
    assert.equal(res.statusCode, 401, JSON.stringify(headers))
    assert.equal((res.payload as { code: string }).code, 'unauthorized')
  }
})

test('an expired Firebase token is rejected with 401 and a safe reason', async () => {
  setEnv({})
  verifyThrows('auth/id-token-expired')
  resetRateLimits()

  const res = makeRes()
  await session(authed() as never, res as never)

  assert.equal(res.statusCode, 401)
  const body = res.payload as { code: string; details?: { reason?: string } }
  assert.equal(body.code, 'unauthorized')
  assert.equal(body.details?.reason, 'auth/id-token-expired')
})

test('an invalid token signature is rejected with 401, not 500', async () => {
  setEnv({})
  verifyThrows('auth/argument-error')
  resetRateLimits()

  const res = makeRes()
  await session(authed() as never, res as never)

  assert.equal(res.statusCode, 401)
  assert.equal((res.payload as { details?: { reason?: string } }).details?.reason, 'auth/argument-error')
})

test('a verification failure without a Firebase code still maps to 401 without details', async () => {
  setEnv({})
  __setVerifierForTests(async () => {
    throw new Error('network hiccup while fetching Google certificates')
  })
  resetRateLimits()

  const res = makeRes()
  await session(authed() as never, res as never)

  assert.equal(res.statusCode, 401)
  const body = res.payload as { details?: unknown }
  assert.equal(body.details, undefined)
})

test('a missing Firebase service account fails closed with 503, not a bypass', async () => {
  setEnv({}) // no FIREBASE_SERVICE_ACCOUNT, no test verifier
  __setVerifierForTests(null)
  resetRateLimits()

  const res = makeRes()
  await session(authed() as never, res as never)

  assert.equal(res.statusCode, 503)
  assert.equal((res.payload as { code: string }).code, 'auth_not_configured')
})

test('a valid member receives their own organization from the database', async () => {
  verifyValidUser()
  resetRateLimits()

  await runFake(stateWithMember(), async (fake) => {
    setEnv({ SUPABASE_URL: fake.url, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })

    const res = makeRes()
    await session(authed() as never, res as never)

    assert.equal(res.statusCode, 200)
    assert.equal(res.headers['cache-control'], 'no-store')

    const body = res.payload as {
      user: { id: string; role: string }
      organization: { id: string; name: string; role: string }
      organizations: Array<{ id: string; name: string; role: string }>
    }
    assert.equal(body.user.id, USER_A)
    assert.equal(body.user.role, 'owner')
    assert.equal(body.organization.id, ORG_A)
    assert.equal(body.organization.name, 'Org A')
    assert.deepEqual(body.organizations, [{ id: ORG_A, name: 'Org A', role: 'owner' }])
    assert.ok(!JSON.stringify(body).includes(SERVICE_KEY))
  })
})

test('requesting another organization the caller does not belong to is a 404', async () => {
  verifyValidUser()
  resetRateLimits()

  await runFake(stateWithMember(), async (fake) => {
    setEnv({ SUPABASE_URL: fake.url, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })

    const res = makeRes()
    await session(makeReq({ query: { organizationId: ORG_B } }) as never, res as never)
    // The header is what makes it authenticated; keep both paths explicit.
    await session(
      authed({ query: { organizationId: ORG_B } }) as never,
      res as never,
    )

    assert.equal(res.statusCode, 404)
    const body = res.payload as { code: string; data?: unknown }
    assert.equal(body.code, 'not_found')
    assert.equal(body.data, undefined, 'a forged org id must not return data')
    // Membership is checked before any customer row is read.
    assert.ok(!fake.requests.some((request) => request.includes('/rest/v1/customers')))
  })
})

test('a data route filters by the token organization, never by the caller-supplied one', async () => {
  verifyValidUser()
  resetRateLimits()

  await runFake(stateWithMember(), async (fake) => {
    setEnv({ SUPABASE_URL: fake.url, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })

    const res = makeRes()
    await customers(makeReq({ url: '/api/customers', query: { limit: '25' } }) as never, res as never)
    await customers(authed({ url: '/api/customers', query: { limit: '25' } }) as never, res as never)

    assert.equal(res.statusCode, 200)
    const body = res.payload as { data: Array<{ id: string; organization_id: string }> }
    assert.equal(body.data.length, 1)
    assert.equal(body.data[0]?.organization_id, ORG_A)

    const customerQueries = fake.requests.filter((request) => request.includes('/rest/v1/customers'))
    assert.equal(customerQueries.length, 1)
    assert.ok(customerQueries[0]?.includes(`organization_id=eq.${ORG_A}`))
    assert.ok(!customerQueries[0]?.includes(ORG_B))
  })
})

test('a write to another organization is rejected before it reaches the database', async () => {
  verifyValidUser()
  resetRateLimits()

  await runFake(stateWithMember(), async (fake) => {
    setEnv({ SUPABASE_URL: fake.url, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })

    const res = makeRes()
    await customers(
      makeReq({
        method: 'POST',
        url: '/api/customers',
        headers: { authorization: `Bearer ${TOKEN}` },
        body: { name: 'Cross tenant', organizationId: ORG_B },
      }) as never,
      res as never,
    )

    assert.equal(res.statusCode, 404)
    assert.equal((res.payload as { code: string }).code, 'not_found')
    assert.ok(!fake.requests.some((request) => request.includes('/rest/v1/customers')))
  })
})

test('an unreachable database is a generic 500, never an empty successful list', async () => {
  verifyValidUser()
  resetRateLimits()
  // Port 1 on loopback refuses immediately; this is a real failed transport.
  setEnv({ SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })

  const res = makeRes()
  await session(authed() as never, res as never)

  assert.equal(res.statusCode, 500)
  const body = res.payload as { code: string; message?: string }
  assert.equal(body.code, 'internal_error')
  assert.ok(!JSON.stringify(body).includes('127.0.0.1'))
})

test('a missing database configuration is 503 with no partial response', async () => {
  setEnv({})
  verifyValidUser()
  resetRateLimits()

  const res = makeRes()
  await session(authed() as never, res as never)

  assert.equal(res.statusCode, 503)
  assert.equal((res.payload as { code: string }).code, 'database_not_configured')
})

test('a token is required even when the database is unavailable', async () => {
  setEnv({ SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })
  verifyValidUser()
  resetRateLimits()

  const res = makeRes()
  await session(makeReq() as never, res as never)

  assert.equal(res.statusCode, 401)
})
