import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import test from 'node:test'
import { handleProviderWebhook } from '../../api/_lib/payments'
import { ApiError } from '../../api/_lib/errors'

const noHeaders = () => undefined

async function expectApiError(
  run: () => Promise<unknown>,
  status: number,
  code: string,
): Promise<void> {
  try {
    await run()
  } catch (err) {
    assert.ok(err instanceof ApiError, 'expected an ApiError')
    assert.equal(err.status, status)
    assert.equal(err.code, code)
    return
  }
  assert.fail(`expected ${status} ${code}`)
}

function clickPayload(overrides: Record<string, string> = {}): Record<string, string> {
  const payload: Record<string, string> = {
    click_trans_id: '101',
    service_id: 'service-1',
    merchant_trans_id: '00000000-0000-4000-8000-000000000000',
    amount: '1000',
    action: '1',
    sign_time: '2026-01-01 00:00:00',
    ...overrides,
  }
  payload.sign_string = createHash('md5')
    .update(
      `${payload.click_trans_id}${payload.service_id}${process.env.CLICK_SECRET_KEY}${payload.merchant_trans_id}${payload.amount}${payload.action}${payload.sign_time}`,
    )
    .digest('hex')
  return payload
}

test('an unknown provider is rejected with 404', async () => {
  await expectApiError(
    () => handleProviderWebhook('unknown', Buffer.from('{}'), noHeaders),
    404,
    'not_found',
  )
})

test('an unconfigured provider fails closed with 503', async () => {
  await expectApiError(
    () => handleProviderWebhook('stripe', Buffer.from('{"type":"x"}'), noHeaders),
    503,
    'payment_not_configured',
  )
})

test('Click: only the service id and secret are required', async () => {
  // CLICK_MERCHANT_ID is not read, so its absence must not disable the provider.
  delete process.env.CLICK_MERCHANT_ID
  process.env.CLICK_SERVICE_ID = 'service-1'
  process.env.CLICK_SECRET_KEY = 'click-secret'

  const payload = clickPayload({ action: '0', merchant_trans_id: 'not-a-uuid' })
  const outcome = await handleProviderWebhook(
    'click',
    Buffer.from(JSON.stringify(payload)),
    noHeaders,
  )
  assert.equal((outcome.body as { error: number }).error, -5)
})

test('Click: a bad signature is rejected before any database access', async () => {
  process.env.CLICK_SERVICE_ID = 'service-1'
  process.env.CLICK_SECRET_KEY = 'click-secret'

  const payload = clickPayload()
  payload.sign_string = 'deadbeef'
  const outcome = await handleProviderWebhook(
    'click',
    Buffer.from(JSON.stringify(payload)),
    noHeaders,
  )
  assert.equal((outcome.body as { error: number }).error, -1)
})

test('Click: a foreign service id is rejected', async () => {
  process.env.CLICK_SERVICE_ID = 'service-1'
  process.env.CLICK_SECRET_KEY = 'click-secret'

  const payload = clickPayload({ service_id: 'other-service' })
  const outcome = await handleProviderWebhook(
    'click',
    Buffer.from(JSON.stringify(payload)),
    noHeaders,
  )
  assert.equal((outcome.body as { error: number }).error, -1)
})

test('Click: a non-positive amount is rejected with -2', async () => {
  process.env.CLICK_SERVICE_ID = 'service-1'
  process.env.CLICK_SECRET_KEY = 'click-secret'

  const payload = clickPayload({ amount: '0' })
  const outcome = await handleProviderWebhook(
    'click',
    Buffer.from(JSON.stringify(payload)),
    noHeaders,
  )
  assert.equal((outcome.body as { error: number }).error, -2)
})

test('Click: a well-formed callback for a real invoice needs the database', async () => {
  // The reference is a valid uuid, so the handler must consult the database;
  // with no database configured that fails closed with 503 instead of 500.
  process.env.CLICK_SERVICE_ID = 'service-1'
  process.env.CLICK_SECRET_KEY = 'click-secret'

  const payload = clickPayload({ action: '0' })
  await expectApiError(
    () => handleProviderWebhook('click', Buffer.from(JSON.stringify(payload)), noHeaders),
    503,
    'database_not_configured',
  )
})

test('Payme: only PAYME_KEY is required for basic auth', async () => {
  delete process.env.PAYME_MERCHANT_ID
  process.env.PAYME_KEY = 'payme-key'

  const payload = { id: 1, method: 'CheckPerformTransaction', params: { amount: 0 } }
  const expected = `Basic ${Buffer.from('Paycom:payme-key').toString('base64')}`

  const outcome = await handleProviderWebhook(
    'payme',
    Buffer.from(JSON.stringify(payload)),
    (name) => (name === 'authorization' ? expected : undefined),
  )
  // Authenticated, then the (non-uuid) invoice reference is reported as missing.
  assert.deepEqual((outcome.body as { error: { code: number } }).error.code, -31050)

  const rejected = await handleProviderWebhook(
    'payme',
    Buffer.from(JSON.stringify(payload)),
    (name) => (name === 'authorization' ? 'Basic bad' : undefined),
  )
  assert.equal((rejected.body as { error: { code: number } }).error.code, -32504)
})

test('Stripe: only STRIPE_WEBHOOK_SECRET is required', async () => {
  delete process.env.STRIPE_SECRET_KEY
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'

  const raw = Buffer.from(JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded' }))
  await expectApiError(
    () =>
      handleProviderWebhook('stripe', raw, (name) =>
        name === 'stripe-signature' ? 't=1,v1=bad' : undefined,
      ),
    401,
    'payment_signature_invalid',
  )
})

test('Stripe: a valid signature on an unhandled event is acknowledged', async () => {
  const secret = 'whsec_test'
  const raw = Buffer.from(JSON.stringify({ id: 'evt_2', type: 'customer.created', data: {} }))
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${raw.toString('utf8')}`)
    .digest('hex')

  const outcome = await handleProviderWebhook('stripe', raw, (name) =>
    name === 'stripe-signature' ? `t=${timestamp},v1=${signature}` : undefined,
  )
  assert.deepEqual(outcome.body, { received: true, handled: false })
})

test('Stripe: an unpaid checkout session is not credited', async () => {
  const secret = 'whsec_test'
  const raw = Buffer.from(
    JSON.stringify({
      id: 'evt_3',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', payment_status: 'unpaid' } },
    }),
  )
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${raw.toString('utf8')}`)
    .digest('hex')

  const outcome = await handleProviderWebhook('stripe', raw, (name) =>
    name === 'stripe-signature' ? `t=${timestamp},v1=${signature}` : undefined,
  )
  assert.deepEqual(outcome.body, { received: true, handled: false })
})
