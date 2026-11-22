import { ApiError, toPublicBody } from './_lib/errors.js'
import {
  requestId as makeRequestId,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from './_lib/http.js'
import chat from './_lib/routes/ai/chat.js'
import insights from './_lib/routes/ai/insights.js'
import message from './_lib/routes/ai/message.js'
import reminder from './_lib/routes/ai/reminder.js'

/**
 * POST /api/ai/chat|insights|message|reminder
 *
 * Those URLs are preserved by the rewrite in vercel.json, which maps the last
 * path segment to `?action=`. Only these four actions exist; anything else is
 * a 404 with the standard error envelope, and no route is reachable that did
 * not exist before. Each action keeps its own body schema, rate limit and auth
 * requirement inside createHandler.
 */
const actions = { chat, insights, message, reminder } as const

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function aiRoute(req: ApiRequest, res: ApiResponse): Promise<void> {
  const action = firstParam(req.query?.action)
  const handler = action ? actions[action as keyof typeof actions] : undefined

  if (!handler) {
    const reqId = makeRequestId(req)
    const { status, body, headers } = toPublicBody(
      new ApiError(404, 'not_found', 'Resource not found'),
      reqId,
    )
    sendJson(res, status, body, { 'x-request-id': reqId, ...(headers ?? {}) })
    return
  }

  await handler(req, res)
}
