/**
 * Firebase ID token verification.
 *
 * The client sends `Authorization: Bearer <firebase id token>`. We verify the
 * token signature, issuer, audience and expiry with the Firebase Admin SDK and
 * derive the user id from the verified token — never from a body/query field.
 *
 * `firebase-admin` is imported lazily so a deployment that has not configured
 * service-account credentials still boots (and answers 503, not 500).
 */
import { ApiError, logServerError } from './errors'
import { header, type ApiRequest } from './http'
import { firebaseServiceAccount, isFirebaseAdminConfigured } from './env'

export type AuthUser = {
  uid: string
  email: string | null
  name: string | null
  picture: string | null
}

type VerifyFn = (idToken: string) => Promise<AuthUser>

function parseServiceAccount(raw: string): Record<string, unknown> {
  const text = raw.trim().startsWith('{')
    ? raw.trim()
    : Buffer.from(raw, 'base64').toString('utf8')
  const parsed: unknown = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not a JSON object')
  }
  return parsed as Record<string, unknown>
}

let verifierPromise: Promise<VerifyFn> | null = null

async function buildVerifier(): Promise<VerifyFn> {
  if (!isFirebaseAdminConfigured()) {
    throw new ApiError(503, 'auth_not_configured', 'Authentication is not configured')
  }

  let appModule: typeof import('firebase-admin/app')
  let authModule: typeof import('firebase-admin/auth')
  try {
    appModule = await import('firebase-admin/app')
    authModule = await import('firebase-admin/auth')
  } catch (err) {
    logServerError('firebase_admin_import_failed', {}, err)
    throw new ApiError(503, 'auth_not_configured', 'Authentication is not configured')
  }

  // isFirebaseAdminConfigured() already guarantees this is present.
  const serviceAccount = parseServiceAccount(firebaseServiceAccount() as string)
  const credential = appModule.cert(serviceAccount)

  const existing = appModule.getApps()
  const app =
    existing.length > 0 ? existing[0] : appModule.initializeApp({ credential })

  const auth = authModule.getAuth(app)

  return async (idToken: string) => {
    const decoded = await auth.verifyIdToken(idToken, true)
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: typeof decoded.name === 'string' ? decoded.name : null,
      picture: typeof decoded.picture === 'string' ? decoded.picture : null,
    }
  }
}

function getVerifier(): Promise<VerifyFn> {
  if (!verifierPromise) {
    verifierPromise = buildVerifier().catch((err) => {
      // Reset so a later request can retry after configuration changes.
      verifierPromise = null
      throw err
    })
  }
  return verifierPromise
}

/** Only used by tests to drop cached state between cases. */
export function resetAuthCache(): void {
  verifierPromise = null
}

export async function requireUser(req: ApiRequest): Promise<AuthUser> {
  const raw = header(req, 'authorization')
  if (!raw) {
    throw new ApiError(401, 'unauthorized', 'Authentication required', {
      headers: { 'www-authenticate': 'Bearer realm="savdopilot"' },
    })
  }
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim())
  if (!match) {
    throw new ApiError(401, 'unauthorized', 'Bearer token required', {
      headers: { 'www-authenticate': 'Bearer realm="savdopilot"' },
    })
  }
  const idToken = match[1].trim()
  if (idToken.length < 20 || idToken.length > 8192) {
    throw new ApiError(401, 'unauthorized', 'Invalid token')
  }

  const verify = await getVerifier()
  try {
    return await verify(idToken)
  } catch (err) {
    if (err instanceof ApiError) throw err
    // Firebase error codes are safe metadata; the token itself is never logged.
    const code =
      err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
    throw new ApiError(401, 'unauthorized', 'Invalid or expired token', {
      details: code.startsWith('auth/') ? { reason: code } : undefined,
    })
  }
}
