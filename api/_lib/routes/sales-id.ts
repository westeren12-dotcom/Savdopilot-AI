import { z } from 'zod'
import { notFound } from '../errors.js'
import { assertCanWrite } from '../tenant.js'
import { createHandler } from '../handler.js'
import { dbQuery, getDb } from '../supabase.js'
import { saleUpdate } from '../validation.js'

const pathQuery = z.strictObject({
  id: z.uuid(),
  organizationId: z.uuid().optional(),
})

/**
 * GET   /api/sales/:id
 * PATCH /api/sales/:id — only status/notes; line items and totals are immutable
 */
export default createHandler<unknown, { id: string; organizationId?: string }>({
  methods: ['GET', 'PATCH'],
  bodySchema: saleUpdate,
  querySchema: pathQuery,
  rateLimit: 'data',
  handler: async ({ body, method, org, query }) => {
    const db = getDb()

    if (method === 'GET') {
      const row = await dbQuery<unknown>('sales_get', () =>
        db
          .from('sales')
          .select('*')
          .eq('id', query.id)
          .eq('organization_id', org.organizationId)
          .maybeSingle() as unknown as PromiseLike<{ data: unknown; error: null }>,
      )
      if (!row) throw notFound('Sale not found')
      return { body: { data: row } }
    }

    assertCanWrite(org)
    const input = body as { status?: string; notes?: string | null }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.status !== undefined) patch.status = input.status
    if (input.notes !== undefined) patch.notes = input.notes

    const row = await dbQuery<unknown>('sales_update', () =>
      db
        .from('sales')
        .update(patch)
        .eq('id', query.id)
        .eq('organization_id', org.organizationId)
        .select('*')
        .maybeSingle() as unknown as PromiseLike<{ data: unknown; error: null }>,
    )
    if (!row) throw notFound('Sale not found')
    return { body: { data: row } }
  },
})
