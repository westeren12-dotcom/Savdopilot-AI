import { assertCanWrite } from '../tenant.js'
import { notFound } from '../errors.js'
import { createHandler } from '../handler.js'
import { dbQuery, dbQueryMaybe, getDb } from '../supabase.js'
import { paginationQuery, saleCreate, type SaleCreateInput } from '../validation.js'

type SaleRow = {
  id: string
  organization_id: string
  customer_id: string | null
  items: unknown
  total: number
  currency: string
  status: string
  notes: string | null
  sold_at: string
  created_at: string
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function saleTotal(items: SaleCreateInput['items']): number {
  return roundMoney(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0))
}

/**
 * GET  /api/sales  — list sales
 * POST /api/sales  — record a sale (totals are computed server-side)
 */
export default createHandler<unknown, { limit: number; offset: number }>({
  methods: ['GET', 'POST'],
  bodySchema: saleCreate,
  querySchema: paginationQuery,
  rateLimit: 'data',
  handler: async ({ body, method, org, query }) => {
    const db = getDb()

    if (method === 'POST') {
      assertCanWrite(org)
      const input = body as SaleCreateInput
      const total = saleTotal(input.items)

      // A client-supplied customer id is only accepted when it belongs to the
      // caller's organization; otherwise it would link a foreign customer.
      if (input.customerId) {
        const customer = await dbQueryMaybe<{ id: string }>('sales_customer_check', () =>
          db
            .from('customers')
            .select('id')
            .eq('id', input.customerId as string)
            .eq('organization_id', org.organizationId)
            .maybeSingle() as unknown as PromiseLike<{
            data: { id: string } | null
            error: null
          }>,
        )
        if (!customer) throw notFound('Customer not found')
      }

      const row = await dbQuery<SaleRow>('sales_create', () =>
        db
          .from('sales')
          .insert({
            organization_id: org.organizationId,
            customer_id: input.customerId ?? null,
            items: input.items,
            total,
            currency: input.currency,
            status: 'completed',
            notes: input.notes ?? null,
            sold_at: input.soldAt ?? new Date().toISOString(),
          })
          .select('*')
          .single() as unknown as PromiseLike<{ data: SaleRow; error: null }>,
      )
      return { status: 201, body: { data: row } }
    }

    const rows = await dbQuery<SaleRow[]>('sales_list', () =>
      db
        .from('sales')
        .select('*')
        .eq('organization_id', org.organizationId)
        .order('sold_at', { ascending: false })
        .range(query.offset, query.offset + query.limit) as unknown as PromiseLike<{
        data: SaleRow[]
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
