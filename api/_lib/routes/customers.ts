import { assertCanWrite } from '../tenant.js'
import { createHandler } from '../handler.js'
import { dbQuery, getDb } from '../supabase.js'
import { customerCreate, paginationQuery } from '../validation.js'

type CustomerRow = {
  id: string
  organization_id: string
  name: string
  phone: string | null
  email: string | null
  status: string
  notes: string | null
  telegram: string | null
  instagram: string | null
  created_at: string
  updated_at: string
}

/**
 * GET  /api/customers   — paginated list for the caller's organization
 * POST /api/customers   — create a customer
 */
export default createHandler<unknown, { limit: number; offset: number }>({
  methods: ['GET', 'POST'],
  bodySchema: customerCreate,
  querySchema: paginationQuery,
  rateLimit: 'data',
  handler: async ({ body, method, org, query }) => {
    const db = getDb()

    if (method === 'POST') {
      assertCanWrite(org)
      const input = body as import('../validation.js').CustomerCreateInput
      const row = await dbQuery<CustomerRow>('customers_create', () =>
        db
          .from('customers')
          .insert({
            organization_id: org.organizationId,
            name: input.name,
            phone: input.phone ?? null,
            email: input.email ?? null,
            status: input.status,
            notes: input.notes ?? null,
            telegram: input.telegram ?? null,
            instagram: input.instagram ?? null,
          })
          .select('*')
          .single() as unknown as PromiseLike<{ data: CustomerRow; error: null }>,
      )
      return { status: 201, body: { data: row } }
    }

    // Fetch one extra row to answer `hasMore` without a second count query.
    const rows = await dbQuery<CustomerRow[]>('customers_list', () =>
      db
        .from('customers')
        .select('*')
        .eq('organization_id', org.organizationId)
        .order('created_at', { ascending: false })
        .range(query.offset, query.offset + query.limit)
        .then((result) => result) as unknown as PromiseLike<{
        data: CustomerRow[]
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
