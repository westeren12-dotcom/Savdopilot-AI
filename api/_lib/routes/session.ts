import { createHandler } from '../handler.js'
import { dbQuery, getDb } from '../supabase.js'
import type { OrgRole } from '../tenant.js'

type MembershipRow = {
  organization_id: string
  role: string
  organizations: { id: string; name: string } | null
}

/**
 * POST /api/auth/session
 *
 * Called once after Firebase sign-in. Verifies the ID token and returns the
 * server-side identity plus the organizations the user belongs to. The first
 * call for a new user creates their personal organization (bootstrap).
 */
export default createHandler<unknown, Record<string, string>>({
  methods: ['POST', 'GET'],
  rateLimit: 'auth',
  handler: async ({ org, user }) => {
    const memberships = await dbQuery<MembershipRow[]>('session_memberships', () =>
      org.userId
        ? (getDb()
            .from('organization_members')
            .select('organization_id, role, organizations(id, name)')
            .eq('user_id', org.userId)
            .order('created_at', { ascending: true }) as unknown as PromiseLike<{
            data: MembershipRow[] | null
            error: null
          }>)
        : Promise.resolve({ data: [] as MembershipRow[], error: null }),
    )

    return {
      body: {
        user: {
          id: org.userId,
          email: org.email ?? user.email,
          displayName: org.displayName ?? user.name,
          role: org.role as OrgRole,
        },
        organization: {
          id: org.organizationId,
          name: org.organizationName,
          role: org.role,
        },
        organizations: (memberships ?? []).map((row) => ({
          id: row.organization_id,
          name: row.organizations?.name ?? 'Business',
          role: row.role,
        })),
      },
    }
  },
})
