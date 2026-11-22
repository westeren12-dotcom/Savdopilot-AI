import { assertCanWrite } from '../_lib/tenant.js'
import { notFound } from '../_lib/errors.js'
import { createHandler } from '../_lib/handler.js'
import { dbQuery, dbQueryMaybe, getDb } from '../_lib/supabase.js'
import { invoiceCreate, paginationQuery, type InvoiceCreateInput } from '../_lib/validation.js'

type InvoiceRow = {
  id: string
  organization_id: string
  customer_id: string
  number: string
  status: string
  currency: string
  subtotal: number
  total: number
  amount_paid: number
  issue_date: string
  due_date: string
  notes: string | null
  created_at: string
}

/**
 * GET  /api/invoices — list invoices
 * POST /api/invoices — create an invoice with its line items
 *
 * Creation goes through the `create_invoice_with_items` SQL function so the
 * header and items are written in one transaction (no half-created invoices).
 */
export default createHandler<unknown, { limit: number; offset: number }>({
  methods: ['GET', 'POST'],
  bodySchema: invoiceCreate,
  querySchema: paginationQuery,
  rateLimit: 'data',
  handler: async ({ body, method, org, query }) => {
    const db = getDb()

    if (method === 'POST') {
      assertCanWrite(org)
      const input = body as InvoiceCreateInput
      const now = new Date()

      // The customer must belong to this organization. Checked before the RPC
      // so a foreign customer id is rejected as 404 and never leaks existence.
      const customer = await dbQueryMaybe<{ id: string }>('invoices_customer_check', () =>
        db
          .from('customers')
          .select('id')
          .eq('id', input.customerId)
          .eq('organization_id', org.organizationId)
          .maybeSingle() as unknown as PromiseLike<{
          data: { id: string } | null
          error: null
        }>,
      )
      if (!customer) throw notFound('Customer not found')
      const items = input.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }))

      const row = await dbQuery<InvoiceRow>('invoices_create', () =>
        db.rpc('create_invoice_with_items', {
          p_organization_id: org.organizationId,
          p_customer_id: input.customerId,
          p_number: input.number ?? null,
          p_currency: input.currency,
          p_issue_date: input.issueDate ?? now.toISOString().slice(0, 10),
          // Required by the schema; never silently defaulted.
          p_due_date: input.dueDate,
          p_notes: input.notes ?? null,
          p_items: items,
        }) as unknown as PromiseLike<{ data: InvoiceRow; error: null }>,
      )
      return { status: 201, body: { data: row } }
    }

    const rows = await dbQuery<InvoiceRow[]>('invoices_list', () =>
      db
        .from('invoices')
        .select('*')
        .eq('organization_id', org.organizationId)
        .order('created_at', { ascending: false })
        .range(query.offset, query.offset + query.limit) as unknown as PromiseLike<{
        data: InvoiceRow[]
        error: null
      }>,
    )

    const list = (rows ?? []).slice(0, query.limit)
    return {
      body: {
        data: list,
        pagination: {
          limit: query.limit,
          offset: query.offset,
          returned: list.length,
          hasMore: (rows ?? []).length > query.limit,
        },
      },
    }
  },
})
