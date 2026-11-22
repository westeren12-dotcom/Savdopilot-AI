import type { ApiRequest, ApiResponse } from './_lib/http.js'
import byId from './_lib/routes/invoices-id.js'
import listOrCreate from './_lib/routes/invoices.js'

/**
 * GET|POST    /api/invoices
 * GET|PATCH   /api/invoices/:id   (vercel.json rewrite -> ?id=:id)
 *
 * Dispatch only; the request pipeline is unchanged.
 */
function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function invoicesRoute(req: ApiRequest, res: ApiResponse): Promise<void> {
  const id = firstParam(req.query?.id)
  if (id) return byId(req, res)
  return listOrCreate(req, res)
}
