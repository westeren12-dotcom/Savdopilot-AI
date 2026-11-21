/**
 * Payment provider callbacks.
 *
 * Rules enforced here:
 *   - a provider is only usable when its credentials exist (otherwise 503),
 *   - every callback is authenticated (signature / HMAC / basic auth) before
 *     anything is written,
 *   - the invoice is identified by OUR reference embedded in the callback,
 *     never by a client-reported "payment succeeded" flag,
 *   - a repeated callback is idempotent (`record_payment` unique key),
 *   - a settled payment is never overwritten by a later callback,
 *   - only the database decides that an invoice is paid.
 *
 * These integrations are prepared, not connected: each provider needs merchant
 * credentials and a callback URL registered on the provider side. Verify Uzum's
 * signing scheme against your merchant contract before going live.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { ApiError, logServerError } from './errors'
import { paymentCredentials } from './env'
import { getDb } from './supabase'

/** `status` defaults to 200; providers read the body, not the HTTP code. */
export type WebhookOutcome = { status?: number; body: unknown }
export type HeaderGetter = (name: string) => string | undefined

export const PAYMENT_PROVIDERS = ['click', 'payme', 'uzum', 'stripe'] as const
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]

export function isPaymentProvider(value: string): value is PaymentProvider {
  return (PAYMENT_PROVIDERS as readonly string[]).includes(value)
}

type PaymentResult = {
  found: boolean
  duplicate?: boolean
  /** The stored payment is already settled (succeeded/cancelled) differently. */
  state_conflict?: boolean
  payment_id?: string
  invoice_status?: string
  amount_paid?: number
  total?: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Provider references reach Postgres as `uuid`; a malformed one raises 22P02,
 * which would turn a bad callback into an endless 500 retry loop.
 */
export function isInvoiceRef(value: string): boolean {
  return UUID_RE.test(value)
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function parseBody(raw: Buffer): Record<string, unknown> {
  const text = raw.toString('utf8').trim()
  if (!text) throw new ApiError(400, 'bad_request', 'Empty callback body')
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(text)
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
    } catch {
      throw new ApiError(400, 'bad_request', 'Callback body must be valid JSON')
    }
  }
  // application/x-www-form-urlencoded (Click)
  const out: Record<string, unknown> = {}
  for (const [key, value] of new URLSearchParams(text)) out[key] = value
  return out
}

function str(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

/** Applies a verified payment to its invoice via one atomic SQL function. */
async function recordPayment(input: {
  provider: PaymentProvider
  providerPaymentId: string
  invoiceId: string
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled'
  raw: unknown
}): Promise<PaymentResult> {
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new ApiError(400, 'bad_request', 'Invalid payment amount')
  }
  // payments.amount is numeric(14,2); a bigger value would raise in Postgres
  // and turn one bad callback into an endless 500 retry loop.
  const amount = Math.min(input.amount, 999_999_999_999.99)
  // Never send a non-uuid to Postgres: it is reported as "not found" instead.
  if (!isInvoiceRef(input.invoiceId) || !input.providerPaymentId) return { found: false }

  const result = await getDb().rpc('record_payment', {
    p_provider: input.provider,
    p_provider_payment_id: input.providerPaymentId,
    p_invoice_id: input.invoiceId,
    p_amount: amount,
    p_currency: input.currency.toUpperCase(),
    p_status: input.status,
    p_raw: input.raw,
  })
  if (result.error) {
    logServerError(
      'payment_record_failed',
      { provider: input.provider, dbCode: result.error.code ?? null },
      new Error(result.error.message),
    )
    throw new ApiError(500, 'internal_error', 'Could not record payment')
  }
  return (result.data ?? { found: false }) as PaymentResult
}

async function invoiceExists(invoiceId: string): Promise<boolean> {
  if (!isInvoiceRef(invoiceId)) return false
  const { data, error } = await getDb().from('invoices').select('id').eq('id', invoiceId).maybeSingle()
  if (error) {
    logServerError('payment_invoice_lookup_failed', { dbCode: error.code ?? null }, new Error(error.message))
    throw new ApiError(500, 'internal_error', 'Database error')
  }
  return Boolean(data)
}

/* ------------------------------- Click -------------------------------- */

/** Click reads `error` from the body; any non-zero value is a rejection. */
const CLICK_ERRORS = {
  sign: { code: -1, note: 'SIGN CHECK FAILED' },
  amount: { code: -2, note: 'Incorrect parameter amount' },
  alreadyPaid: { code: -4, note: 'Already paid' },
  invoice: { code: -5, note: 'Invoice not found' },
  transaction: { code: -6, note: 'Transaction not found' },
} as const

function clickRespond(
  payload: Record<string, unknown>,
  error: (typeof CLICK_ERRORS)[keyof typeof CLICK_ERRORS] | null,
  extra: Record<string, unknown> = {},
): WebhookOutcome {
  return {
    body: {
      error: error?.code ?? 0,
      error_note: error?.note ?? 'Success',
      click_trans_id: payload.click_trans_id ?? null,
      merchant_trans_id: payload.merchant_trans_id ?? null,
      ...extra,
    },
  }
}

async function handleClick(payload: Record<string, unknown>): Promise<WebhookOutcome> {
  const creds = paymentCredentials('click')
  if (!creds) throw new ApiError(503, 'payment_not_configured', 'Click is not configured')

  const clickTransId = str(payload.click_trans_id)
  const serviceId = str(payload.service_id)
  const merchantTransId = str(payload.merchant_trans_id)
  const amount = Number(str(payload.amount))
  const action = str(payload.action)
  const signTime = str(payload.sign_time)
  const signString = str(payload.sign_string)

  if (!clickTransId || !merchantTransId || !signTime || !signString || !action) {
    throw new ApiError(400, 'bad_request', 'Incomplete Click callback')
  }
  if (serviceId !== creds.serviceId) {
    // A foreign service id cannot produce a valid signature either way.
    return clickRespond(payload, CLICK_ERRORS.sign)
  }

  const expected = createHash('md5')
    .update(
      `${clickTransId}${serviceId}${creds.secret}${merchantTransId}${str(payload.amount)}${action}${signTime}`,
    )
    .digest('hex')

  if (!safeEqual(expected, signString.toLowerCase())) {
    logServerError('click_signature_invalid', { clickTransId }, new Error('signature mismatch'))
    return clickRespond(payload, CLICK_ERRORS.sign)
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return clickRespond(payload, CLICK_ERRORS.amount)
  }

  // action=0 is the prepare step: acknowledge only when the invoice exists.
  if (action === '0') {
    if (!(await invoiceExists(merchantTransId))) {
      return clickRespond(payload, CLICK_ERRORS.invoice)
    }
    return clickRespond(payload, null, {
      merchant_prepare_id: Number(clickTransId) || 0,
    })
  }

  if (action !== '1') {
    throw new ApiError(400, 'bad_request', 'Unsupported Click action')
  }

  if (!(await invoiceExists(merchantTransId))) {
    return clickRespond(payload, CLICK_ERRORS.invoice)
  }

  const providerError = Number(str(payload.error))
  const declaredFailed = Number.isFinite(providerError) && providerError < 0

  const result = await recordPayment({
    provider: 'click',
    providerPaymentId: clickTransId,
    invoiceId: merchantTransId,
    amount: declaredFailed ? 0 : amount,
    currency: 'UZS',
    status: declaredFailed ? 'failed' : 'succeeded',
    raw: payload,
  })

  if (result.state_conflict) {
    logServerError('click_state_conflict', { clickTransId }, new Error('payment already settled'))
    return clickRespond(payload, CLICK_ERRORS.alreadyPaid)
  }

  return clickRespond(payload, null, {
    // Click expects a numeric confirm id; ours is a uuid, so echo theirs.
    merchant_confirm_id: declaredFailed ? null : Number(clickTransId) || 0,
  })
}

/* ------------------------------- Payme -------------------------------- */

const PAYME_ERRORS = {
  auth: { code: -32504, message: 'Authorization failed' },
  method: { code: -32601, message: 'Method not found' },
  params: { code: -32602, message: 'Invalid params' },
  invoice: { code: -31050, message: 'Invoice not found' },
  amount: { code: -31001, message: 'Invalid amount' },
  transaction: { code: -31003, message: 'Transaction not found' },
  state: { code: -31008, message: 'Transaction state conflict' },
} as const

function paymeRespond(id: unknown, result: unknown, error?: { code: number; message: string }): WebhookOutcome {
  return {
    body: error
      ? { jsonrpc: '2.0', id: id ?? null, error }
      : { jsonrpc: '2.0', id: id ?? null, result },
  }
}

async function handlePayme(
  payload: Record<string, unknown>,
  getHeader: HeaderGetter,
): Promise<WebhookOutcome> {
  const creds = paymentCredentials('payme')
  if (!creds) throw new ApiError(503, 'payment_not_configured', 'Payme is not configured')

  const auth = getHeader('authorization') ?? ''
  const expected = `Basic ${Buffer.from(`Paycom:${creds.key}`).toString('base64')}`
  if (!auth || !safeEqual(auth, expected)) {
    logServerError('payme_auth_failed', {}, new Error('authorization mismatch'))
    return paymeRespond(payload.id, null, PAYME_ERRORS.auth)
  }

  const method = str(payload.method)
  const params = (payload.params ?? {}) as Record<string, unknown>
  const account = (params.account ?? {}) as Record<string, unknown>
  const invoiceId = str(account.invoice_id ?? account.invoiceId ?? account.order_id)
  const transactionId = str(params.id)
  // Payme sends `amount` in tiyin (1 UZS = 100 tiyin); our invoices are in UZS.
  const amountTiyin = Number(str(params.amount))
  const amount = Number.isFinite(amountTiyin) ? amountTiyin / 100 : NaN

  if (method === 'CheckPerformTransaction') {
    if (!invoiceId || !(await invoiceExists(invoiceId))) {
      return paymeRespond(payload.id, null, PAYME_ERRORS.invoice)
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return paymeRespond(payload.id, null, PAYME_ERRORS.amount)
    }
    return paymeRespond(payload.id, { allow: true })
  }

  if (method === 'CreateTransaction') {
    if (!invoiceId || !transactionId) return paymeRespond(payload.id, null, PAYME_ERRORS.params)
    if (!Number.isFinite(amount) || amount < 0) return paymeRespond(payload.id, null, PAYME_ERRORS.amount)
    if (!(await invoiceExists(invoiceId))) return paymeRespond(payload.id, null, PAYME_ERRORS.invoice)

    const result = await recordPayment({
      provider: 'payme',
      providerPaymentId: transactionId,
      invoiceId,
      amount,
      currency: 'UZS',
      status: 'pending',
      raw: payload,
    })
    if (result.state_conflict) return paymeRespond(payload.id, null, PAYME_ERRORS.state)

    return paymeRespond(payload.id, {
      create_time: Date.now(),
      transaction: result.payment_id ?? transactionId,
      state: 1,
    })
  }

  if (method === 'PerformTransaction') {
    if (!invoiceId || !transactionId) return paymeRespond(payload.id, null, PAYME_ERRORS.params)
    if (!Number.isFinite(amount) || amount < 0) return paymeRespond(payload.id, null, PAYME_ERRORS.amount)
    if (!(await invoiceExists(invoiceId))) return paymeRespond(payload.id, null, PAYME_ERRORS.invoice)

    const result = await recordPayment({
      provider: 'payme',
      providerPaymentId: transactionId,
      invoiceId,
      amount,
      currency: 'UZS',
      status: 'succeeded',
      raw: payload,
    })
    if (result.state_conflict) return paymeRespond(payload.id, null, PAYME_ERRORS.state)

    return paymeRespond(payload.id, {
      perform_time: Date.now(),
      transaction: result.payment_id ?? transactionId,
      state: 2,
    })
  }

  if (method === 'CancelTransaction') {
    if (!invoiceId || !transactionId) return paymeRespond(payload.id, null, PAYME_ERRORS.params)
    if (!(await invoiceExists(invoiceId))) return paymeRespond(payload.id, null, PAYME_ERRORS.invoice)

    // A settled payment is not reversed: refunds are out of scope here.
    const result = await recordPayment({
      provider: 'payme',
      providerPaymentId: transactionId,
      invoiceId,
      amount: 0,
      currency: 'UZS',
      status: 'cancelled',
      raw: payload,
    })
    if (result.state_conflict) return paymeRespond(payload.id, null, PAYME_ERRORS.state)

    return paymeRespond(payload.id, {
      cancel_time: Date.now(),
      transaction: result.payment_id ?? transactionId,
      state: -2,
    })
  }

  return paymeRespond(payload.id, null, PAYME_ERRORS.method)
}

/* -------------------------------- Uzum -------------------------------- */

async function handleUzum(
  raw: Buffer,
  payload: Record<string, unknown>,
  getHeader: HeaderGetter,
): Promise<WebhookOutcome> {
  const creds = paymentCredentials('uzum')
  if (!creds) throw new ApiError(503, 'payment_not_configured', 'Uzum is not configured')

  // Uzum's contract defines the signing input; this build verifies an
  // HMAC-SHA256 of the raw body supplied in `x-signature` (hex). Confirm the
  // exact scheme with Uzum before enabling live payments.
  const provided = (getHeader('x-signature') ?? str(payload.sign)).toLowerCase()
  const expected = createHmac('sha256', creds.secret).update(raw).digest('hex')
  if (!provided || !safeEqual(expected, provided)) {
    throw new ApiError(401, 'payment_signature_invalid', 'Invalid Uzum signature')
  }

  const invoiceId = str(payload.orderId ?? payload.order_id)
  const paymentId = str(payload.paymentId ?? payload.payment_id)
  const status = str(payload.status).toLowerCase()
  const amount = Number(str(payload.amount))

  if (!invoiceId || !paymentId) throw new ApiError(400, 'bad_request', 'Incomplete Uzum callback')
  if (!(await invoiceExists(invoiceId))) throw new ApiError(404, 'not_found', 'Invoice not found')

  const succeeded = ['paid', 'success', 'succeeded', 'completed', 'confirmed'].includes(status)
  const failed = ['failed', 'cancelled', 'canceled', 'rejected'].includes(status)

  const result = await recordPayment({
    provider: 'uzum',
    providerPaymentId: paymentId,
    invoiceId,
    amount: succeeded ? amount : 0,
    currency: str(payload.currency) || 'UZS',
    status: succeeded ? 'succeeded' : failed ? 'failed' : 'pending',
    raw: payload,
  })

  if (result.state_conflict) {
    // Acknowledge so Uzum stops retrying; the stored state is authoritative.
    logServerError('uzum_state_conflict', { paymentId }, new Error('payment already settled'))
  }

  return { body: { status: 'OK', paymentId, invoiceStatus: result.invoice_status ?? null } }
}

/* ------------------------------- Stripe ------------------------------- */

function verifyStripeSignature(raw: Buffer, header: string, secret: string): boolean {
  const parts = header.split(',').map((part) => part.trim())
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2) ?? ''
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3))

  if (!timestamp || signatures.length === 0) return false
  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(age) || age > 300) return false

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${raw.toString('utf8')}`)
    .digest('hex')

  return signatures.some((signature) => safeEqual(expected, signature))
}

/** Only these events can change an invoice; everything else is acknowledged. */
const STRIPE_HANDLED = new Set([
  'checkout.session.completed',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
])

async function handleStripe(
  raw: Buffer,
  payload: Record<string, unknown>,
  getHeader: HeaderGetter,
): Promise<WebhookOutcome> {
  const creds = paymentCredentials('stripe')
  if (!creds) throw new ApiError(503, 'payment_not_configured', 'Stripe is not configured')

  const signature = getHeader('stripe-signature')
  if (!signature || !verifyStripeSignature(raw, signature, creds.webhookSecret)) {
    logServerError('stripe_signature_invalid', {}, new Error('signature mismatch'))
    throw new ApiError(401, 'payment_signature_invalid', 'Invalid Stripe signature')
  }

  const type = str(payload.type)
  if (!STRIPE_HANDLED.has(type)) {
    // e.g. an unrelated customer/invoice event: acknowledge, do not retry.
    return { body: { received: true, handled: false } }
  }

  const data = (payload.data ?? {}) as Record<string, unknown>
  const object = (data.object ?? {}) as Record<string, unknown>
  const metadata = (object.metadata ?? null) as Record<string, unknown> | null

  const isCheckout = type === 'checkout.session.completed'
  const isFailed = type === 'payment_intent.payment_failed'

  // A completed Checkout session is not necessarily paid (delayed methods).
  if (isCheckout && str(object.payment_status) !== 'paid') {
    return { body: { received: true, handled: false } }
  }

  const invoiceId = str(metadata?.invoiceId ?? object.client_reference_id)
  // The PaymentIntent id is the stable key across checkout and intent events,
  // so the same money is never credited twice under two different event ids.
  const providerPaymentId = str(object.payment_intent) || str(object.id) || str(payload.id)

  if (!providerPaymentId) throw new ApiError(400, 'bad_request', 'Missing payment reference')

  if (!invoiceId) {
    // Nothing to reconcile; acknowledge so Stripe does not retry forever.
    return { body: { received: true, handled: false } }
  }
  if (!(await invoiceExists(invoiceId))) {
    logServerError('stripe_invoice_missing', { providerPaymentId }, new Error('invoice not found'))
    return { body: { received: true, handled: false } }
  }

  const amountMinor = Number(str(object.amount_total ?? object.amount_received ?? object.amount))
  const amount = Number.isFinite(amountMinor) ? amountMinor / 100 : 0

  const result = await recordPayment({
    provider: 'stripe',
    providerPaymentId,
    invoiceId,
    amount: isFailed ? 0 : amount,
    currency: str(object.currency) || 'USD',
    status: isFailed ? 'failed' : 'succeeded',
    raw: payload,
  })

  if (result.state_conflict) {
    logServerError('stripe_state_conflict', { providerPaymentId }, new Error('payment already settled'))
  }

  return {
    body: { received: true, handled: Boolean(result.found), invoiceStatus: result.invoice_status ?? null },
  }
}

export async function handleProviderWebhook(
  provider: string,
  raw: Buffer,
  getHeader: HeaderGetter,
): Promise<WebhookOutcome> {
  if (!isPaymentProvider(provider)) throw new ApiError(404, 'not_found', 'Unknown payment provider')

  const payload = parseBody(raw)
  switch (provider) {
    case 'click':
      return handleClick(payload)
    case 'payme':
      return handlePayme(payload, getHeader)
    case 'uzum':
      return handleUzum(raw, payload, getHeader)
    case 'stripe':
      return handleStripe(raw, payload, getHeader)
  }
}
