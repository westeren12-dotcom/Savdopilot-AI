/**
 * Tests for GET /api/stats — organization-scoped user statistics.
 *
 * These run the real handler pipeline, the real tenant resolver and the real
 * supabase-js client. Firebase token verification is replaced through the
 * documented test hook and PostgREST is replaced by a small HTTP server that
 * understands `eq`/`gte` filters, `head`+count requests (answered through
 * `content-range`, exactly like PostgREST), `single`/`maybeSingle` and the
 * `bootstrap_account` RPC. So scoping, counts and error mapping are real; token
 * cryptography and PostgreSQL itself are covered elsewhere (auth-flow.test.ts
 * and tests/db/run.mjs).
 */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import stats from '../../api/stats'
import { __setVerifierForTests, type AuthUser } from '../../api/_lib/auth'
import { resetRateLimits } from '../../api/_lib/rate-limit'
import { dbCount } from '../../api/_lib/supabase'

process.env.NODE_ENV = 'test'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const ORG_C = '33333333-3333-4333-8333-333333333333'
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TOKEN = 'header.payload.signature-for-stats-tests'
const SERVICE_KEY = 'service-role-key-for-stats-tests'

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString()

type Row = Record<string, unknown>
type FakeState = {
  users: Row[]
  organizations: Row[]
  organization_members: Row[]
}

type FakePostgrest = {
  url: string
  /** `${method} ${path}${search}` for every request, in order. */
  requests: string[]
  rpcCalls: Array<Record<string, unknown>>
  close: () => Promise<void>
}

type FakeOptions = {
  /** Answer count queries without `content-range`, like a broken proxy. */
  omitCount?: boolean
}

function compare(left: unknown, right: unknown): number {
  const a = Date.parse(String(left))
  const b = Date.parse(String(right))
  if (!Number.isNaN(a) && !Number.isNaN(b) && /\d{4}-\d{2}-\d{2}T/.test(String(left))) {
    return a - b
  }
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0
}

function startFakePostgrest(
  state: FakeState,
  options: FakeOptions = {},
): Promise<FakePostgrest> {
  const requests: string[] = []
  const rpcCalls: Array<Record<string, unknown>> = []
  let createdOrganizations = 0

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    requests.push(`${req.method ?? 'GET'} ${url.pathname}${url.search}`)

    const send = (status: number, body: unknown): void => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }

    // The provisioning RPC: creates user + organization + owner membership.
    if (url.pathname === '/rest/v1/rpc/bootstrap_account') {
      let raw = ''
      req.on('data', (chunk) => {
        raw += chunk
      })
      req.on('end', () => {
        const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
        rpcCalls.push(body)
        const uid = String(body.p_firebase_uid ?? '')
        let user = state.users.find((row) => row.firebase_uid === uid)
        if (!user) {
          user = { id: `user-${uid}`, firebase_uid: uid, email: body.p_email ?? null }
          state.users.push(user)
        }
        createdOrganizations += 1
        const organizationId = `44444444-4444-4444-8444-${String(createdOrganizations).padStart(12, '0')}`
        const name = 'New business'
        state.organizations.push({ id: organizationId, name })
        state.organization_members.push({
          user_id: user.id,
          organization_id: organizationId,
          role: 'owner',
          created_at: new Date().toISOString(),
          organizations: { name },
        })
        send(200, [
          {
            user_id: user.id,
            organization_id: organizationId,
            organization_name: name,
            role: 'owner',
          },
        ])
      })
      return
    }

    const table = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname)?.[1]
    const rows = table ? (state as unknown as Record<string, Row[]>)[table] : undefined
    if (!rows) {
      send(404, { code: '42P01', message: `relation public.${table ?? '?'} does not exist` })
      return
    }

    let matched = rows.slice()
    for (const [key, value] of url.searchParams) {
      if (['select', 'order', 'limit', 'offset', 'apikey'].includes(key)) continue
      const dot = value.indexOf('.')
      const op = dot === -1 ? 'eq' : value.slice(0, dot)
      const expected = dot === -1 ? value : value.slice(dot + 1)
      if (op === 'eq') matched = matched.filter((row) => String(row[key]) === expected)
      else if (op === 'gte') matched = matched.filter((row) => compare(row[key], expected) >= 0)
      else if (op === 'lte') matched = matched.filter((row) => compare(row[key], expected) <= 0)
    }

    const order = url.searchParams.get('order')
    if (order) {
      const [column, direction] = order.split('.')
      matched.sort((a, b) => compare(a[column], b[column]) * (direction === 'desc' ? -1 : 1))
    }
    const limit = url.searchParams.get('limit')
    if (limit) matched = matched.slice(0, Number(limit))

    // `select(..., { count: 'exact', head: true })`: PostgREST answers with no
    // body and the count in `content-range`.
    if (req.method === 'HEAD') {
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (!options.omitCount) headers['content-range'] = `*/${matched.length}`
      res.writeHead(200, headers)
      res.end()
      return
    }

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
        rpcCalls,
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
  'PLATFORM_ADMIN_UIDS',
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
    url: '/api/stats',
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

function verifyValidUser(uid = 'firebase-uid-a'): void {
  __setVerifierForTests(
    async (): Promise<AuthUser> => ({
      uid,
      email: 'a@example.com',
      name: 'A',
      picture: null,
    }),
  )
}

/** One owner plus two more members in ORG_A, and an unrelated ORG_B member. */
function stateWithMembers(): FakeState {
  return {
    users: [
      { id: USER_A, firebase_uid: 'firebase-uid-a', email: 'a@example.com', display_name: 'A' },
    ],
    organizations: [
      { id: ORG_A, name: 'Org A', created_at: '2025-01-01T00:00:00Z' },
      { id: ORG_B, name: 'Org B', created_at: '2025-01-01T00:00:00Z' },
      { id: '33333333-3333-4333-8333-333333333333', name: 'Org C', created_at: '2025-01-01T00:00:00Z' },
    ],
    organization_members: [
      // Oldest in ORG_A, so the default-organization lookup resolves to it.
      { user_id: USER_A, organization_id: ORG_A, role: 'owner', created_at: daysAgo(200), organizations: { name: 'Org A' } },
      { user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', organization_id: ORG_A, role: 'viewer', created_at: daysAgo(10), organizations: { name: 'Org A' } },
      { user_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', organization_id: ORG_A, role: 'manager', created_at: daysAgo(1), organizations: { name: 'Org A' } },
      { user_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', organization_id: ORG_B, role: 'owner', created_at: daysAgo(2), organizations: { name: 'Org B' } },
    ],
  }
}

/** One user who belongs to ORG_A (oldest, so default) and ORG_B, plus ORG_C. */
function stateWithTwoOrgs(): FakeState {
  return {
    users: [
      { id: USER_A, firebase_uid: 'firebase-uid-a', email: 'a@example.com', display_name: 'A' },
    ],
    organizations: [
      { id: ORG_A, name: 'Org A', created_at: '2025-01-01T00:00:00Z' },
      { id: ORG_B, name: 'Org B', created_at: '2025-01-01T00:00:00Z' },
      { id: ORG_C, name: 'Org C', created_at: '2025-01-01T00:00:00Z' },
    ],
    organization_members: [
      { user_id: USER_A, organization_id: ORG_A, role: 'owner', created_at: daysAgo(60), organizations: { name: 'Org A' } },
      { user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', organization_id: ORG_A, role: 'viewer', created_at: daysAgo(4), organizations: { name: 'Org A' } },
      { user_id: USER_A, organization_id: ORG_B, role: 'manager', created_at: daysAgo(30), organizations: { name: 'Org B' } },
      { user_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', organization_id: ORG_B, role: 'owner', created_at: daysAgo(1), organizations: { name: 'Org B' } },
    ],
  }
}

async function runFake(
  state: FakeState,
  body: (fake: FakePostgrest) => Promise<void>,
  options: FakeOptions = {},
): Promise<void> {
  const fake = await startFakePostgrest(state, options)
  try {
    await body(fake)
  } finally {
    await fake.close()
  }
}

test('statistics without a token are rejected before any lookup', async () => {
  setEnv({})
  let calls = 0
  __setVerifierForTests(async () => {
    calls += 1
    throw new Error('must not be called')
  })
  resetRateLimits()

  const res = makeRes()
  await stats(makeReq() as never, res as never)

  assert.equal(res.statusCode, 401)
  assert.equal((res.payload as { code: string }).code, 'unauthorized')
  assert.equal(calls, 0)
})

test('an invalid Firebase token is a 401 with a safe reason and no stats', async () => {
  setEnv({})
  __setVerifierForTests(async () => {
    throw Object.assign(new Error('bad token'), { code: 'auth/id-token-revoked' })
  })
  resetRateLimits()

  const res = makeRes()
  await stats(authed() as never, res as never)

  assert.equal(res.statusCode, 401)
  const body = res.payload as { code: string; details?: { reason?: string }; users?: unknown }
  assert.equal(body.code, 'unauthorized')
  assert.equal(body.details?.reason, 'auth/id-token-revoked')
  assert.equal(body.users, undefined)
})

test('a signed-in caller with no database configured gets 503, never empty stats', async () => {
  setEnv({})
  verifyValidUser()
  resetRateLimits()

  const res = makeRes()
  await stats(authed() as never, res as never)

  assert.equal(res.statusCode, 503)
  assert.equal((res.payload as { code: string }).code, 'database_not_configured')
  assert.equal((res.payload as { users?: unknown }).users, undefined)
})

test('counts cover the caller organization only, with 7 and 30 day windows', async () => {
  verifyValidUser()
  resetRateLimits()

  await runFake(stateWithMembers(), async (fake) => {
    setEnv({ SUPABASE_URL: fake.url, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })

    const res = makeRes()
    await stats(authed() as never, res as never)

    assert.equal(res.statusCode, 200)
    assert.equal(res.headers['cache-control'], 'no-store')

    const body = res.payload as {
      organization: { id: string; name: string; role: string }
      users: { total: number; newLast7Days: number; newLast30Days: number }
      organizations: { total: number } | null
    }
    assert.deepEqual(body.organization, { id: ORG_A, name: 'Org A', role: 'owner' })
    assert.deepEqual(body.users, { total: 3, newLast7Days: 1, newLast30Days: 2 })
    // No platform admin is configured, so the cross-org aggregate is absent.
    assert.equal(body.organizations, null)

    // Identities are never read: the three count queries are HEAD requests that
    // transfer no rows, and the only row-level read is the caller's own
    // membership (needed to resolve the organization and role).
    const memberReads = fake.requests.filter((r) => r.includes('/rest/v1/organization_members'))
    const countReads = memberReads.filter((r) => r.includes('select=user_id'))
    assert.equal(countReads.length, 3)
    for (const request of countReads) {
      assert.ok(request.startsWith('HEAD '), `member rows were read: ${request}`)
      assert.ok(request.includes(`organization_id=eq.${ORG_A}`), request)
    }
    for (const request of memberReads.filter((r) => !r.includes('select=user_id'))) {
      assert.ok(request.includes(`user_id=eq.${USER_A}`), `unexpected member read: ${request}`)
    }
    for (const request of fake.requests) {
      assert.ok(!request.includes(ORG_B), `another organization leaked: ${request}`)
    }
    assert.ok(!JSON.stringify(body).includes('@example.com'))
  })
})

test('asking for another organization is a 404 and reads no statistics', async () => {
  verifyValidUser()
  resetRateLimits()

  await runFake(stateWithMembers(), async (fake) => {
    setEnv({ SUPABASE_URL: fake.url, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })

    const res = makeRes()
    await stats(authed({ query: { organizationId: ORG_B } }) as never, res as never)

    assert.equal(res.statusCode, 404)
    assert.equal((res.payload as { code: string }).code, 'not_found')
    assert.equal((res.payload as { users?: unknown }).users, undefined)
    assert.ok(!fake.requests.some((request) => request.startsWith('HEAD ')))
  })
})

test('a platform administrator receives the total organization count', async () => {
  verifyValidUser()
  resetRateLimits()

  await runFake(stateWithMembers(), async (fake) => {
    setEnv({
      SUPABASE_URL: fake.url,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      PLATFORM_ADMIN_UIDS: 'firebase-uid-someone-else, firebase-uid-a',
    })

    const res = makeRes()
    await stats(authed() as never, res as never)

    assert.equal(res.statusCode, 200)
    const body = res.payload as {
      users: { total: number }
      organizations: { total: number } | null
    }
    assert.deepEqual(body.organizations, { total: 3 })
    // Still scoped to the caller's own organization for member counts.
    assert.equal(body.users.total, 3)
  })
})

test('a first sign-in provisions an organization server-side, ignoring a requested id', async () => {
  verifyValidUser()
  resetRateLimits()

  const state: FakeState = { users: [], organizations: [], organization_members: [] }

  await runFake(state, async (fake) => {
    setEnv({ SUPABASE_URL: fake.url, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })

    const res = makeRes()
    await stats(authed({ query: { organizationId: ORG_B } }) as never, res as never)

    assert.equal(res.statusCode, 200)
    const body = res.payload as {
      organization: { id: string; role: string }
      users: { total: number; newLast7Days: number }
    }
    assert.equal(body.organization.role, 'owner')
    assert.notEqual(body.organization.id, ORG_B)
    assert.deepEqual(body.users, { total: 1, newLast7Days: 1, newLast30Days: 1 })

    // The uid comes from the verified token, never from the request body.
    assert.equal(fake.rpcCalls.length, 1)
    assert.equal(fake.rpcCalls[0]?.p_firebase_uid, 'firebase-uid-a')
    assert.equal(state.organization_members.length, 1)
    assert.equal(state.organization_members[0]?.role, 'owner')
    assert.equal(state.organization_members[0]?.organization_id, body.organization.id)
  })
})

test('an existing member keeps their organization and role without re-provisioning', async () => {
  verifyValidUser()
  resetRateLimits()

  await runFake(stateWithMembers(), async (fake) => {
    setEnv({ SUPABASE_URL: fake.url, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })

    const res = makeRes()
    await stats(authed() as never, res as never)

    assert.equal(res.statusCode, 200)
    assert.equal((res.payload as { organization: { role: string } }).organization.role, 'owner')
    assert.equal(fake.rpcCalls.length, 0)
  })
})

test('a member of two organizations gets each organization with its own counts', async () => {
  verifyValidUser()
  resetRateLimits()

  await runFake(stateWithTwoOrgs(), async (fake) => {
    setEnv({ SUPABASE_URL: fake.url, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })

    // Default resolution: the oldest membership.
    const first = makeRes()
    await stats(authed() as never, first as never)
    assert.equal(first.statusCode, 200)
    assert.deepEqual((first.payload as { organization: unknown }).organization, {
      id: ORG_A,
      name: 'Org A',
      role: 'owner',
    })
    assert.equal((first.payload as { users: { total: number } }).users.total, 2)

    // Explicit selection of the second membership resolves to that organization's role.
    const beforeSecond = fake.requests.length
    const second = makeRes()
    await stats(authed({ query: { organizationId: ORG_B } }) as never, second as never)
    assert.equal(second.statusCode, 200)
    const body = second.payload as {
      organization: { id: string; name: string; role: string }
      users: { total: number }
    }
    assert.deepEqual(body.organization, { id: ORG_B, name: 'Org B', role: 'manager' })
    assert.equal(body.users.total, 2)
    // The count queries for the selected organization followed it only.
    const counts = fake.requests
      .slice(beforeSecond)
      .filter((request) => request.startsWith('HEAD ') && request.includes('select=user_id'))
    assert.equal(counts.length, 3)
    assert.ok(counts.every((request) => request.includes(`organization_id=eq.${ORG_B}`)))
  })
})

test('a user who is not a member of the requested organization gets 404', async () => {
  verifyValidUser()
  resetRateLimits()

  await runFake(stateWithTwoOrgs(), async (fake) => {
    setEnv({ SUPABASE_URL: fake.url, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })

    const res = makeRes()
    await stats(authed({ query: { organizationId: ORG_C } }) as never, res as never)

    assert.equal(res.statusCode, 404)
    assert.equal((res.payload as { code: string }).code, 'not_found')
    assert.equal((res.payload as { users?: unknown }).users, undefined)
    // No count query ran for an organization the caller cannot see.
    assert.ok(!fake.requests.some((request) => request.startsWith('HEAD ')))
  })
})

test('the statistics endpoint answers 429 once the organization limit is reached', async () => {
  verifyValidUser()
  resetRateLimits()

  await runFake(stateWithMembers(), async (fake) => {
    setEnv({ SUPABASE_URL: fake.url, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })

    // `data` allows 120 requests per minute, keyed by organization.
    for (let i = 0; i < 120; i++) {
      const ok = makeRes()
      await stats(authed() as never, ok as never)
      assert.equal(ok.statusCode, 200, `request ${i + 1} was rejected`)
    }

    const limited = makeRes()
    await stats(authed() as never, limited as never)
    assert.equal(limited.statusCode, 429)
    assert.equal((limited.payload as { code: string }).code, 'rate_limited')
    assert.equal(limited.headers['x-ratelimit-remaining'], '0')
    assert.ok(Number(limited.headers['retry-after']) >= 1)
  })
})

test('a missing exact count is an error, never a misleading zero', async () => {
  verifyValidUser()
  resetRateLimits()

  await runFake(
    stateWithMembers(),
    async (fake) => {
      setEnv({ SUPABASE_URL: fake.url, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })

      const res = makeRes()
      await stats(authed() as never, res as never)

      assert.equal(res.statusCode, 500)
      assert.equal((res.payload as { code: string }).code, 'internal_error')
      // No statistics object at all: the UI shows its error state.
      assert.equal((res.payload as { users?: unknown }).users, undefined)
      assert.equal((res.payload as { organization?: unknown }).organization, undefined)
    },
    { omitCount: true },
  )
})

test('dbCount accepts only a real, non-negative integer count', async () => {
  const ok = async (count: number) => ({ count, error: null })

  assert.equal(await dbCount('test', () => ok(0)), 0)
  assert.equal(await dbCount('test', () => ok(7)), 7)

  for (const count of [null, Number.NaN, -1, 1.5, Number.POSITIVE_INFINITY]) {
    await assert.rejects(
      dbCount('test', async () => ({ count, error: null })),
      (err: unknown) => (err as { code?: string }).code === 'internal_error',
      `count ${String(count)} was accepted`,
    )
  }
})

test('PLATFORM_ADMIN_UIDS parsing ignores whitespace and empty entries', async () => {
  verifyValidUser()
  resetRateLimits()

  // Only separators and spaces: nobody is an administrator, so no aggregate.
  await runFake(stateWithMembers(), async (fake) => {
    setEnv({
      SUPABASE_URL: fake.url,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      PLATFORM_ADMIN_UIDS: ' ,  , ',
    })
    const res = makeRes()
    await stats(authed() as never, res as never)
    assert.equal(res.statusCode, 200)
    assert.equal((res.payload as { organizations: unknown }).organizations, null)
  })

  resetRateLimits()

  // Surrounding whitespace is trimmed, so the uid still matches.
  await runFake(stateWithMembers(), async (fake) => {
    setEnv({
      SUPABASE_URL: fake.url,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      PLATFORM_ADMIN_UIDS: '  , firebase-uid-a  , ,',
    })
    const res = makeRes()
    await stats(authed() as never, res as never)
    assert.equal(res.statusCode, 200)
    assert.deepEqual((res.payload as { organizations: unknown }).organizations, { total: 3 })
  })
})

test('the statistics endpoint is read-only', async () => {
  setEnv({})
  verifyValidUser()
  resetRateLimits()

  const res = makeRes()
  await stats(makeReq({ method: 'POST' }) as never, res as never)

  assert.equal(res.statusCode, 405)
  assert.equal(res.headers['allow'], 'GET')
})
