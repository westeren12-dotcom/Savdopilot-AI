import type { ApiRequest, ApiResponse } from './_lib/http.js'
import byId from './_lib/routes/customers-id.js'
import listOrCreate from './_lib/routes/customers.js'

/**
 * GET|POST         /api/customers
 * GET|PATCH|DELETE /api/customers/:id   (vercel.json rewrite -> ?id=:id)
 *
 * Dispatch only. Authentication, tenant isolation, Zod validation, rate
 * limiting, CORS and error handling all stay inside the createHandler pipeline
 * of the route modules below, exactly as before the merge.
 */
function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function customersRoute(req: ApiRequest, res: ApiResponse): Promise<void> {
  const id = firstParam(req.query?.id)
  if (id) return byId(req, res)
  return listOrCreate(req, res)
}
