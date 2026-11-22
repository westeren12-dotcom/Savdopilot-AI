import assert from 'node:assert/strict'
import test from 'node:test'
import ai from '../../api/ai'
import auth from '../../api/auth'
import customers from '../../api/customers'
import invoices from '../../api/invoices'
import sales from '../../api/sales'

/**
 * Router-level tests for the consolidation into seven Vercel Functions.
 *
 * The routers must not change behaviour: they only pick the existing handler.
 * Dispatch is proven by deterministic validation answers (422/405/404) that
 * run before authentication, and by the error envelope the pipeline produces.
 */

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
    url: '/api/test',
    headers: {} as Record<string, string>,
    query: {} as Record<string, string | string[]>,
    socket: { remoteAddress: '10.0.0.1' },
    ...overrides,
  }
}

function code(res: FakeResponse): string {
  return (res.payload as { code?: string }).code ?? ''
}

/** Without Firebase/Supabase configured the pipeline fails closed (401/503). */
function assertFailsClosed(res: FakeResponse): void {
  assert.ok(
    res.statusCode === 401 || res.statusCode >= 500,
    `expected 401 or 5xx, got ${res.statusCode}`,
  )
  assert.ok(['unauthorized', 'auth_not_configured', 'database_not_configured'].includes(code(res)), `unexpected code ${code(res)}`)
}

test('customers: collection URL dispatches to the list/create handler', async () => {
  const res = makeRes()
  await customers(makeReq({ url: '/api/customers' }) as never, res as never)
  assertFailsClosed(res)
})

test('customers: ?id=<invalid uuid> dispatches to the by-id handler (422)', async () => {
  const res = makeRes()
  await customers(makeReq({ url: '/api/customers?id=not-a-uuid', query: { id: 'not-a-uuid' } }) as never, res as never)
  assert.equal(res.statusCode, 422)
  assert.equal(code(res), 'validation_error')
})

test('customers: an unsupported method is still 405 with the Allow header', async () => {
  const res = makeRes()
  await customers(makeReq({ method: 'PUT', url: '/api/customers' }) as never, res as never)
  assert.equal(res.statusCode, 405)
  assert.equal(code(res), 'method_not_allowed')
  assert.equal(res.headers['allow'], 'GET, POST')
})

test('customers: preflight on a rewritten :id URL is still answered with 204', async () => {
  const res = makeRes()
  await customers(
    makeReq({
      method: 'OPTIONS',
      url: '/api/customers/00000000-0000-4000-8000-000000000001?organizationId=00000000-0000-4000-8000-000000000002',
      query: { id: '00000000-0000-4000-8000-000000000001', organizationId: '00000000-0000-4000-8000-000000000002' },
      headers: { origin: 'http://localhost:5173' },
    }) as never,
    res as never,
  )
  assert.equal(res.statusCode, 204)
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173')
  assert.equal(res.headers['cache-control'], 'no-store')
})

test('sales: ?id dispatches to the by-id handler and keeps its methods', async () => {
  const invalid = makeRes()
  await sales(makeReq({ url: '/api/sales?id=nope', query: { id: 'nope' } }) as never, invalid as never)
  assert.equal(invalid.statusCode, 422)
  assert.equal(code(invalid), 'validation_error')

  const notAllowed = makeRes()
  await sales(makeReq({ method: 'PUT', url: '/api/sales' }) as never, notAllowed as never)
  assert.equal(notAllowed.statusCode, 405)
  assert.equal(notAllowed.headers['allow'], 'GET, POST')
})

test('invoices: by-id dispatch, create validation and method gate are unchanged', async () => {
  const byId = makeRes()
  await invoices(makeReq({ url: '/api/invoices?id=nope', query: { id: 'nope' } }) as never, byId as never)
  assert.equal(byId.statusCode, 422)
  assert.equal(code(byId), 'validation_error')

  const create = makeRes()
  await invoices(makeReq({ method: 'POST', url: '/api/invoices', body: {} }) as never, create as never)
  assert.equal(create.statusCode, 422)
  assert.equal(code(create), 'validation_error')

  const notAllowed = makeRes()
  await invoices(makeReq({ method: 'DELETE', url: '/api/invoices' }) as never, notAllowed as never)
  assert.equal(notAllowed.statusCode, 405)
  assert.equal(notAllowed.headers['allow'], 'GET, POST')
})

test('ai: each action reaches its own handler (auth enforced, method gated)', async () => {
  const chat = makeRes()
  await ai(
    makeReq({
      method: 'POST',
      url: '/api/ai/chat',
      query: { action: 'chat' },
      body: { messages: [{ role: 'user', content: 'Salom' }] },
    }) as never,
    chat as never,
  )
  assertFailsClosed(chat)

  const insights = makeRes()
  await ai(makeReq({ method: 'POST', url: '/api/ai/insights', query: { action: 'insights' }, body: {} }) as never, insights as never)
  assertFailsClosed(insights)

  const wrongMethod = makeRes()
  await ai(makeReq({ method: 'GET', url: '/api/ai/chat', query: { action: 'chat' } }) as never, wrongMethod as never)
  assert.equal(wrongMethod.statusCode, 405)
  assert.equal(wrongMethod.headers['allow'], 'POST')
})

test('ai: an unknown or missing action is a 404 and never reaches a handler', async () => {
  const unknown = makeRes()
  await ai(makeReq({ method: 'POST', url: '/api/ai/nope', query: { action: 'nope' }, body: {} }) as never, unknown as never)
  assert.equal(unknown.statusCode, 404)
  assert.equal(code(unknown), 'not_found')
  assert.match(unknown.headers['x-request-id'] ?? '', /^[0-9a-f-]{36}$/)

  const missing = makeRes()
  await ai(makeReq({ method: 'POST', url: '/api/ai', body: {} }) as never, missing as never)
  assert.equal(missing.statusCode, 404)
  assert.equal(code(missing), 'not_found')
})

test('ai: preflight on a rewritten action URL is answered with 204', async () => {
  const res = makeRes()
  await ai(
    makeReq({
      method: 'OPTIONS',
      url: '/api/ai/chat',
      query: { action: 'chat' },
      headers: { origin: 'http://localhost:5173' },
    }) as never,
    res as never,
  )
  assert.equal(res.statusCode, 204)
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173')
})

test('auth: the session route keeps both verbs and rejects the rest', async () => {
  const ok = makeRes()
  await auth(makeReq({ method: 'GET', url: '/api/auth/session' }) as never, ok as never)
  assertFailsClosed(ok)

  const notAllowed = makeRes()
  await auth(makeReq({ method: 'DELETE', url: '/api/auth/session' }) as never, notAllowed as never)
  assert.equal(notAllowed.statusCode, 405)
  assert.equal(notAllowed.headers['allow'], 'POST, GET')
})
