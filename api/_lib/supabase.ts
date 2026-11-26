/**
 * Supabase access for the API.
 *
 * SECURITY: this uses the SERVICE ROLE key, which bypasses Row Level Security.
 * That is deliberate: the API is the enforcement layer (every query is filtered
 * by the caller's organization_id), and RLS stays enabled as defence in depth
 * for any other access path. Never import this module from `src/`.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ApiError, logServerError } from './errors.js'
import { isDatabaseConfigured, supabaseServiceRoleKey, supabaseUrl } from './env.js'

let cached: SupabaseClient | null = null
let cachedFingerprint = ''

export function getDb(): SupabaseClient {
  if (!isDatabaseConfigured()) {
    throw new ApiError(503, 'database_not_configured', 'Database is not configured')
  }
  const url = supabaseUrl() as string
  const key = supabaseServiceRoleKey() as string
  const fingerprint = `${url}:${key.slice(-12)}`

  if (!cached || cachedFingerprint !== fingerprint) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { 'x-application-name': 'savdopilot-api' } },
    })
    cachedFingerprint = fingerprint
  }
  return cached
}

export type DbResponse<T> = {
  data: T | null
  error: { message: string; code?: string } | null
}

/**
 * Runs a query and converts driver/business errors into a generic 500.
 * The database message is logged server-side only, so SQL details and table
 * names never reach the client.
 */
export async function dbQuery<T>(
  event: string,
  run: () => PromiseLike<DbResponse<T>>,
): Promise<T> {
  let result: DbResponse<T>
  try {
    result = await run()
  } catch (err) {
    logServerError(event, { stage: 'transport' }, err)
    throw new ApiError(500, 'internal_error', 'Database error')
  }
  if (result.error) {
    logServerError(
      event,
      { stage: 'query', dbCode: result.error.code ?? null },
      new Error(result.error.message),
    )
    throw clientError(result.error.code)
  }
  return result.data as T
}

type DbCountResponse = {
  count: number | null
  error: { message: string; code?: string } | null
}

/**
 * Runs a HEAD/count query. PostgREST reports the row count in `content-range`,
 * so `.select(columns, { count: 'exact', head: true })` never transfers rows.
 * Used for aggregates (statistics) where reading every row would be wasteful
 * and would silently cap at the project's max-rows setting.
 */
export async function dbCount(
  event: string,
  run: () => PromiseLike<DbCountResponse>,
): Promise<number> {
  let result: DbCountResponse
  try {
    result = await run()
  } catch (err) {
    logServerError(event, { stage: 'transport' }, err)
    throw new ApiError(500, 'internal_error', 'Database error')
  }
  if (result.error) {
    logServerError(
      event,
      { stage: 'query', dbCode: result.error.code ?? null },
      new Error(result.error.message),
    )
    throw clientError(result.error.code)
  }
  // An exact count is only usable when PostgREST actually reported one. A
  // missing/garbled `content-range` must surface as an error (the UI then shows
  // its error state), because returning 0 would look like real, empty data.
  if (
    typeof result.count !== 'number' ||
    !Number.isSafeInteger(result.count) ||
    result.count < 0
  ) {
    logServerError(event, { stage: 'count' }, new Error('PostgREST returned no exact count'))
    throw new ApiError(500, 'internal_error', 'Database error')
  }
  return result.count
}

/**
 * Constraint violations are the client's fault, not a server fault: reporting
 * them as 500 makes a retryable input error look like an outage. The SQL text
 * still never reaches the client.
 */
function clientError(code: string | undefined): ApiError {
  switch (code) {
    case '23505':
      return new ApiError(409, 'conflict', 'Resource already exists')
    case '23502':
    case '23503':
    case '22P02':
    case '23514':
    // P0001 is `raise exception` from our own SQL functions (e.g. "customer
    // not found in organization"): always an input problem, never an outage.
    case 'P0001':
      return new ApiError(400, 'bad_request', 'Invalid value in request')
    default:
      return new ApiError(500, 'internal_error', 'Database error')
  }
}

/** Query result that may legitimately be empty. */
export async function dbQueryMaybe<T>(
  event: string,
  run: () => PromiseLike<DbResponse<T>>,
): Promise<T | null> {
  const data = await dbQuery<T>(event, run)
  return data ?? null
}
