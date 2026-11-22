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
import { ApiError, logServerError, logServerInfo } from './errors.js'
import { header, type ApiRequest } from './http.js'
import { firebaseProjectId, firebaseServiceAccount, isFirebaseAdminConfigured } from './env.js'

export type AuthUser = {
  uid: string
  email: string | null
  name: string | null
  picture: string | null
}

type VerifyFn = (idToken: string) => Promise<AuthUser>

export type FirebaseServiceAccount = {
  project_id: string
  client_email: string
  private_key: string
  [key: string]: unknown
}

/**
 * Environment variables and CI secret stores routinely mangle PEM newlines:
 * the key arrives with literal `\n` sequences, or with CRLF from Windows. The
 * Admin SDK needs a real multi-line PEM, so normalise it here and fail with an
 * actionable message when the value is not a private key at all (a truncated
 * paste, a key id, or the public key by mistake).
 */
function normalizePrivateKey(rawKey: string): string {
  const key = rawKey.replace(/\\n/g, '\n').replace(/\r\n?/g, '\n').trim()
  if (!key.includes('BEGIN PRIVATE KEY')) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT.private_key is not a PEM private key')
  }
  return `${key}\n`
}

/**
 * Parses `FIREBASE_SERVICE_ACCOUNT` — plain JSON or its base64 encoding — and
 * validates the three fields the Admin SDK actually needs. Errors name the
 * field only; the key itself is never included in a message or a log line.
 */
export function parseFirebaseServiceAccount(raw: string): FirebaseServiceAccount {
  const trimmed = raw.trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    // Not plain JSON, so try the documented one-line form: base64 of the JSON.
    try {
      parsed = JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8').trim())
    } catch {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT is not valid JSON (plain JSON or its base64 encoding is required)',
      )
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT must be a JSON object')
  }

  const record = parsed as Record<string, unknown>
  const type = record.type
  if (typeof type === 'string' && type !== 'service_account') {
    // `gcloud auth application-default login` writes an "authorized_user"
    // credential, which cannot verify ID tokens.
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT is a "${type}" credential, not a service account key`,
    )
  }

  const projectId = typeof record.project_id === 'string' ? record.project_id.trim() : ''
  const clientEmail =
    typeof record.client_email === 'string' ? record.client_email.trim() : ''
  const rawKey = typeof record.private_key === 'string' ? record.private_key : ''

  if (!projectId) throw new Error('FIREBASE_SERVICE_ACCOUNT is missing project_id')
  if (!clientEmail) throw new Error('FIREBASE_SERVICE_ACCOUNT is missing client_email')
  if (!rawKey) throw new Error('FIREBASE_SERVICE_ACCOUNT is missing private_key')

  return {
    ...record,
    project_id: projectId,
    client_email: clientEmail,
    private_key: normalizePrivateKey(rawKey),
  }
}

export type FirebaseAuthStatus = 'ok' | 'missing' | 'invalid' | 'project_mismatch'

/**
 * Configuration health for `/api/health`. A project-id mismatch does not throw:
 * the service account is authoritative for verification, and refusing to boot
 * would turn a stale `VITE_FIREBASE_PROJECT_ID` into a total outage. It is
 * reported so the drift is visible instead of surfacing as 401s for every user.
 */
export function firebaseAuthStatus(): FirebaseAuthStatus {
  const raw = firebaseServiceAccount()
  if (!raw) return 'missing'

  let account: FirebaseServiceAccount
  try {
    account = parseFirebaseServiceAccount(raw)
  } catch {
    return 'invalid'
  }

  const configured = firebaseProjectId()
  if (configured && configured !== account.project_id) return 'project_mismatch'
  return 'ok'
}

let verifierPromise: Promise<VerifyFn> | null = null
/** Test-only override; see __setVerifierForTests. */
let testVerifier: VerifyFn | null = null

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
  const serviceAccount = parseFirebaseServiceAccount(firebaseServiceAccount() as string)

  const configuredProject = firebaseProjectId()
  if (configuredProject && configuredProject !== serviceAccount.project_id) {
    // Project ids are not secrets; the mismatch itself is the diagnostic.
    logServerInfo('firebase_project_id_mismatch', {
      configuredProjectId: configuredProject,
      serviceAccountProjectId: serviceAccount.project_id,
    })
  }

  // The Admin SDK's ServiceAccount type is camelCase; map explicitly instead of
  // handing it the snake_case JSON.
  const credential = appModule.cert({
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
  })

  const existing = appModule.getApps()
  // Pinning projectId makes the token audience deterministic instead of
  // inherited from whatever app happened to be initialised first.
  const app =
    existing.length > 0
      ? existing[0]
      : appModule.initializeApp({ credential, projectId: serviceAccount.project_id })

  const auth = authModule.getAuth(app)

  return async (idToken: string) => {
    // checkRevoked=true also rejects tokens revoked by an admin or sign-out.
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
  if (testVerifier) return Promise.resolve(testVerifier)
  if (!verifierPromise) {
    verifierPromise = buildVerifier().catch((err) => {
      // Reset so a later request can retry after configuration changes.
      verifierPromise = null
      throw err
    })
  }
  return verifierPromise
}

/**
 * TEST-ONLY injection point. Real token verification needs a Firebase project
 * and a service account; these tests instead replace the verifier and exercise
 * everything above and below it (header parsing, error mapping, tenant
 * resolution). Refuses to run outside `NODE_ENV=test`, which Vercel never sets,
 * so there is no production path that can install a fake verifier.
 */
export function __setVerifierForTests(fn: VerifyFn | null): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('__setVerifierForTests is only available when NODE_ENV=test')
  }
  testVerifier = fn
  verifierPromise = null
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
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: unknown }).code)
        : ''
    throw new ApiError(401, 'unauthorized', 'Invalid or expired token', {
      details: code.startsWith('auth/') ? { reason: code } : undefined,
    })
  }
}
