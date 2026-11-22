import { z } from 'zod'
import { notFound } from '../_lib/errors.js'
import { assertCanWrite } from '../_lib/tenant.js'
import { createHandler } from '../_lib/handler.js'
import { dbQuery, getDb } from '../_lib/supabase.js'
import { invoiceUpdate } from '../_lib/validation.js'

const pathQuery = z.strictObject({
  id: z.uuid(),
  organizationId: z.uuid().optional(),
})

type InvoiceItemRow = {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  line_total: number
}

/**
 * GET   /api/invoices/:id — invoice plus its line items
 * PATCH /api/invoices/:id — status (never `paid`), due date, notes
 *
 * `paid` is intentionally absent from the update schema; payment status changes
 * only through a verified provider callback (see api/payments/[provider]/webhook).
 */
export default createHandler<unknown, { id: string; organizationId?: string }>({
  methods: ['GET', 'PATCH'],
  bodySchema: invoiceUpdate,
  querySchema: pathQuery,
  rateLimit: 'data',
  handler: async ({ body, method, org, query }) => {
    const db = getDb()

    if (method === 'GET') {
      const invoice = await dbQuery<unknown>('invoices_get', () =>
        db
          .from('invoices')
          .select('*')
          .eq('id', query.id)
          .eq('organization_id', org.organizationId)
          .maybeSingle() as unknown as PromiseLike<{ data: unknown; error: null }>,
      )
      if (!invoice) throw notFound('Invoice not found')

      const items = await dbQuery<InvoiceItemRow[]>('invoice_items_list', () =>
        db
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', query.id)
          .order('created_at', { ascending: true }) as unknown as PromiseLike<{
          data: InvoiceItemRow[]
          error: null
        }>,
      )
      return { body: { data: { ...(invoice as object), items: items ?? [] } } }
    }

    assertCanWrite(org)
    const input = body as { status?: string; dueDate?: string; notes?: string | null }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.status !== undefined) patch.status = input.status
    if (input.dueDate !== undefined) patch.due_date = input.dueDate
    if (input.notes !== undefined) patch.notes = input.notes

    const row = await dbQuery<unknown>('invoices_update', () =>
      db
        .from('invoices')
        .update(patch)
        .eq('id', query.id)
        .eq('organization_id', org.organizationId)
        .select('*')
        .maybeSingle() as unknown as PromiseLike<{ data: unknown; error: null }>,
    )
    if (!row) throw notFound('Invoice not found')
    return { body: { data: row } }
  },
})
