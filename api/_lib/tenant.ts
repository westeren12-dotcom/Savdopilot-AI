/**
 * Tenant resolution.
 *
 * A request never names its own user id or organization membership. We resolve
 * them from the verified token:
 *   1. look up `users` by firebase_uid,
 *   2. take the requested organization only if a membership row exists,
 *   3. otherwise fall back to the user's first organization,
 *   4. a brand-new user gets one organization via the atomic `bootstrap_account`
 *      SQL function (user + org + owner membership in a single transaction).
 *
 * Every data query in the routes additionally filters by organization_id.
 */
import { ApiError } from './errors'
import type { AuthUser } from './auth'
import { getDb, dbQuery } from './supabase'

export type OrgRole = 'owner' | 'admin' | 'manager' | 'viewer'

export type OrgContext = {
  userId: string
  organizationId: string
  organizationName: string
  role: OrgRole
  email: string | null
  displayName: string | null
}

export type MembershipRow = {
  organization_id: string
  role: string
}

const ROLES: OrgRole[] = ['owner', 'admin', 'manager', 'viewer']
const WRITE_ROLES: OrgRole[] = ['owner', 'admin', 'manager']

export function normalizeRole(value: string): OrgRole {
  return ROLES.includes(value as OrgRole) ? (value as OrgRole) : 'viewer'
}

export function canWrite(role: OrgRole): boolean {
  return WRITE_ROLES.includes(role)
}

export function assertCanWrite(org: OrgContext): void {
  if (!canWrite(org.role)) {
    throw new ApiError(403, 'forbidden', 'Your role cannot modify this data')
  }
}

type BootstrapRow = {
  user_id: string
  organization_id: string
  organization_name: string | null
  role: string
}

type UserRow = { id: string; email: string | null; display_name: string | null }

/** Idempotent: creates the user's first organization on first sign-in. */
export async function bootstrapAccount(user: AuthUser): Promise<OrgContext> {
  const db = getDb()
  const rows = await dbQuery<BootstrapRow[]>('bootstrap_account', () =>
    db.rpc('bootstrap_account', {
      p_firebase_uid: user.uid,
      p_email: user.email,
      p_display_name: user.name,
    }) as unknown as PromiseLike<{ data: BootstrapRow[] | null; error: null }>,
  )
  const row = Array.isArray(rows) ? rows[0] : null
  if (!row) {
    throw new ApiError(500, 'internal_error', 'Account bootstrap failed')
  }
  return {
    userId: row.user_id,
    organizationId: row.organization_id,
    organizationName: row.organization_name ?? 'My business',
    role: normalizeRole(row.role),
    email: user.email,
    displayName: user.name,
  }
}

/**
 * Resolves the caller's organization. `requestedOrganizationId` comes from the
 * validated request but is only honoured if a membership row proves access.
 */
export async function requireOrgContext(
  user: AuthUser,
  requestedOrganizationId?: string,
): Promise<OrgContext> {
  const db = getDb()

  const userRow = await dbQuery<UserRow | null>('tenant_lookup_user', () =>
    db
      .from('users')
      .select('id, email, display_name')
      .eq('firebase_uid', user.uid)
      .maybeSingle() as unknown as PromiseLike<{ data: UserRow | null; error: null }>,
  )

  if (!userRow) return bootstrapAccount(user)

  let membership: (MembershipRow & { organizations: { name: string } | null }) | null = null

  if (requestedOrganizationId) {
    membership = await dbQuery<MembershipRow & { organizations: { name: string } | null }>(
      'tenant_membership_requested',
      () =>
        db
          .from('organization_members')
          .select('organization_id, role, organizations(name)')
          .eq('user_id', userRow.id)
          .eq('organization_id', requestedOrganizationId)
          .maybeSingle() as unknown as PromiseLike<{
          data: (MembershipRow & { organizations: { name: string } | null }) | null
          error: null
        }>,
    )
    if (!membership) {
      // Same response as a missing organization: membership is not disclosable.
      throw new ApiError(404, 'not_found', 'Organization not found')
    }
  } else {
    membership = await dbQuery<MembershipRow & { organizations: { name: string } | null }>(
      'tenant_membership_default',
      () =>
        db
          .from('organization_members')
          .select('organization_id, role, organizations(name)')
          .eq('user_id', userRow.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle() as unknown as PromiseLike<{
          data: (MembershipRow & { organizations: { name: string } | null }) | null
          error: null
        }>,
    )
    if (!membership) return bootstrapAccount(user)
  }

  return {
    userId: userRow.id,
    organizationId: membership.organization_id,
    organizationName: membership.organizations?.name ?? 'My business',
    role: normalizeRole(membership.role),
    email: userRow.email ?? user.email,
    displayName: userRow.display_name ?? user.name,
  }
}
