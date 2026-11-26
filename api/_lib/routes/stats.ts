/**
 * GET /api/stats — organization-scoped statistics for the dashboard.
 *
 * Scope comes from `requireOrgContext` (the pipeline resolves it from the
 * verified Firebase token and a membership row), so this route never accepts an
 * organization, user or role from the request. Counts are HEAD queries, so no
 * member row (email, id, display name) is ever read or returned — only totals.
 *
 * Activity is intentionally absent: the schema has no last-seen column, so
 * "active users" has no reliable definition here and is not invented.
 */
import { platformAdminUids } from '../env.js'
import { createHandler } from '../handler.js'
import { dbCount, getDb } from '../supabase.js'

const DAY_MS = 24 * 60 * 60 * 1000

/** ISO timestamp for "N days ago"; `created_at` is timestamptz. */
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

type CountQuery = PromiseLike<{ count: number | null; error: null }>

export default createHandler<unknown, Record<string, never>>({
  methods: ['GET'],
  rateLimit: 'data',
  handler: async ({ org, user }) => {
    const db = getDb()

    const memberCount = (since?: string): Promise<number> => {
      const filtered = db
        .from('organization_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('organization_id', org.organizationId)
      const query = since ? filtered.gte('created_at', since) : filtered
      return dbCount('stats_members', () => query as unknown as CountQuery)
    }

    const [total, newLast7Days, newLast30Days] = await Promise.all([
      memberCount(),
      memberCount(isoDaysAgo(7)),
      memberCount(isoDaysAgo(30)),
    ])

    // Matched against the *verified* token uid. An empty allowlist means the
    // aggregate is unavailable to everyone, not that every caller is an admin.
    const isPlatformAdmin = platformAdminUids().includes(user.uid)
    const organizations = isPlatformAdmin
      ? {
          total: await dbCount('stats_organizations', () =>
            db
              .from('organizations')
              .select('id', { count: 'exact', head: true }) as unknown as CountQuery,
          ),
        }
      : null

    return {
      body: {
        organization: {
          id: org.organizationId,
          name: org.organizationName,
          role: org.role,
        },
        users: { total, newLast7Days, newLast30Days },
        organizations,
      },
    }
  },
})
