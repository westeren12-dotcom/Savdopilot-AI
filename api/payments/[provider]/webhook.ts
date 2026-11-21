import { ApiError, logServerError, toPublicBody } from '../../_lib/errors'
import { clientIp, header, readRawBody, requestId as makeRequestId, sendJson, type ApiRequest, type ApiResponse } from '../../_lib/http'
import { RATE_LIMITS, rateLimit } from '../../_lib/rate-limit'
import { handleProviderWebhook } from '../../_lib/payments'

export const config = {
  api: {
    // Keep the body unparsed so signature checks see the provider's bytes.
    bodyParser: false,
  },
}

/**
 * POST /api/payments/:provider/webhook
 *
 * Provider -> us only. No CORS, no session, no client-reported success: the
 * callback is authenticated by the provider's signature scheme and the invoice
 * state is changed by `record_payment` alone.
 */
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const reqId = makeRequestId(req)
  try {
    if ((req.method ?? 'GET').toUpperCase() !== 'POST') {
      throw new ApiError(405, 'method_not_allowed', 'Method not allowed', {
        headers: { allow: 'POST' },
      })
    }

    const limit = rateLimit(`payments:${clientIp(req)}`, RATE_LIMITS.payments.limit, RATE_LIMITS.payments.windowMs)
    if (!limit.ok) {
      throw new ApiError(429, 'rate_limited', 'Too many requests', {
        headers: { 'retry-after': String(limit.retryAfterSeconds) },
      })
    }

    const raw = await readRawBody(req)
    if (!raw || raw.length === 0) {
      throw new ApiError(400, 'bad_request', 'Empty callback body')
    }

    const provider = String(req.query?.provider ?? '')
    const outcome = await handleProviderWebhook(provider, raw, (name) => header(req, name))
    sendJson(res, outcome.status ?? 200, outcome.body, { 'x-request-id': reqId })
  } catch (err) {
    const { status, body, headers } = toPublicBody(err, reqId)
    if (status >= 500) {
      logServerError('payment_webhook_failed', { requestId: reqId, path: req.url ?? null }, err)
    }
    sendJson(res, status, body, { 'x-request-id': reqId, ...(headers ?? {}) })
  }
}
