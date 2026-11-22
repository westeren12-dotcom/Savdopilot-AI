import { z } from 'zod'
import { notFound } from '../_lib/errors.js'
import { assertCanWrite } from '../_lib/tenant.js'
import { createHandler } from '../_lib/handler.js'
import { dbQuery, getDb } from '../_lib/supabase.js'
import { customerUpdate, type CustomerUpdateInput } from '../_lib/validation.js'

const pathQuery = z.strictObject({
  id: z.uuid(),
  organizationId: z.uuid().optional(),
})

type CustomerRow = { id: string; organization_id: string }

/**
 * GET    /api/customers/:id
 * PATCH  /api/customers/:id
 * DELETE /api/customers/:id
 *
 * Every statement filters by organization_id as well as id, so a customer of
 * another tenant is reported as 404 — identical to a genuinely missing row.
 */
export default createHandler<unknown, { id: string; organizationId?: string }>({
  methods: ['GET', 'PATCH', 'DELETE'],
  bodySchema: customerUpdate,
  querySchema: pathQuery,
  rateLimit: 'data',
  handler: async ({ body, method, org, query }) => {
    const db = getDb()

    if (method === 'GET') {
      const row = await dbQuery<unknown>('customers_get', () =>
        db
          .from('customers')
          .select('*')
          .eq('id', query.id)
          .eq('organization_id', org.organizationId)
          .maybeSingle() as unknown as PromiseLike<{ data: unknown; error: null }>,
      )
      if (!row) throw notFound('Customer not found')
      return { body: { data: row } }
    }

    assertCanWrite(org)

    if (method === 'DELETE') {
      const deleted = await dbQuery<CustomerRow | null>('customers_delete', () =>
        db
          .from('customers')
          .delete()
          .eq('id', query.id)
          .eq('organization_id', org.organizationId)
          .select('id, organization_id')
          .maybeSingle() as unknown as PromiseLike<{ data: CustomerRow | null; error: null }>,
      )
      if (!deleted) throw notFound('Customer not found')
      return { body: { data: { id: deleted.id, deleted: true } } }
    }

    const input = body as CustomerUpdateInput
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of [
      'name',
      'phone',
      'email',
      'status',
      'notes',
      'telegram',
      'instagram',
    ] as const) {
      if (input[key] !== undefined) patch[key] = input[key]
    }

    const row = await dbQuery<unknown>('customers_update', () =>
      db
        .from('customers')
        .update(patch)
        .eq('id', query.id)
        .eq('organization_id', org.organizationId)
        .select('*')
        .maybeSingle() as unknown as PromiseLike<{ data: unknown; error: null }>,
    )
    if (!row) throw notFound('Customer not found')
    return { body: { data: row } }
  },
})
