import assert from 'node:assert/strict'
import test from 'node:test'
import {
  corsAllowedOrigins,
  firebaseProjectId,
  isDatabaseConfigured,
  isFirebaseAdminConfigured,
  paymentCredentials,
  platformAdminUids,
  resolveAiConfig,
  supabaseConfigStatus,
  supabaseUrl,
} from '../../api/_lib/env'

const ENV_KEYS = [
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FIREBASE_SERVICE_ACCOUNT',
  'FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_PROJECT_ID',
  'ALLOWED_ORIGINS',
  'PLATFORM_ADMIN_UIDS',
  'APP_URL',
  'VITE_APP_URL',
  'AI_PROVIDER',
  'AI_API_KEY',
  'AI_API_BASE_URL',
  'OMNIROUTE_API_KEY',
  'CLICK_SERVICE_ID',
  'CLICK_SECRET_KEY',
  'PAYME_KEY',
  'UZUM_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
]

function setEnv(values: Record<string, string | undefined> = {}): void {
  for (const key of ENV_KEYS) delete process.env[key]
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) process.env[key] = value
  }
}

const KEY = 'service-role-key-for-tests'

test('Supabase URL is accepted as https and normalised', () => {
  setEnv({ SUPABASE_URL: 'https://abcdefgh.supabase.co/' })
  assert.equal(supabaseUrl(), 'https://abcdefgh.supabase.co')

  // The docs page shows the REST path; supabase-js appends it itself.
  setEnv({ SUPABASE_URL: 'https://abcdefgh.supabase.co/rest/v1/' })
  assert.equal(supabaseUrl(), 'https://abcdefgh.supabase.co')
})

test('plaintext HTTP to a remote host is refused: the service role key bypasses RLS', () => {
  setEnv({ SUPABASE_URL: 'http://abcdefgh.supabase.co', SUPABASE_SERVICE_ROLE_KEY: KEY })
  assert.equal(supabaseUrl(), undefined)
  assert.equal(isDatabaseConfigured(), false)
  assert.equal(supabaseConfigStatus(), 'invalid_url')
})

test('loopback HTTP stays available for local PostgREST', () => {
  setEnv({ SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: KEY })
  assert.equal(supabaseUrl(), 'http://127.0.0.1:54321')
  assert.equal(supabaseConfigStatus(), 'ok')
})

test('a malformed URL and credentials embedded in the URL are refused', () => {
  for (const value of [
    'not-a-url',
    'ftp://abcdefgh.supabase.co',
    'https://user:pass@abcdefgh.supabase.co',
  ]) {
    setEnv({ SUPABASE_URL: value, SUPABASE_SERVICE_ROLE_KEY: KEY })
    assert.equal(supabaseUrl(), undefined, value)
    assert.equal(supabaseConfigStatus(), 'invalid_url', value)
  }
})

test('the database needs both a URL and a service role key', () => {
  setEnv({ SUPABASE_URL: 'https://abcdefgh.supabase.co' })
  assert.equal(isDatabaseConfigured(), false)
  assert.equal(supabaseConfigStatus(), 'not_configured')

  setEnv({ SUPABASE_URL: 'https://abcdefgh.supabase.co', SUPABASE_SERVICE_ROLE_KEY: KEY })
  assert.equal(isDatabaseConfigured(), true)
  assert.equal(supabaseConfigStatus(), 'ok')
})

test('.env.example placeholders count as "not configured"', () => {
  setEnv({
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'your-service-role-key',
  })
  assert.equal(supabaseUrl(), undefined)
  assert.equal(isDatabaseConfigured(), false)
  assert.equal(supabaseConfigStatus(), 'not_configured')
})

test('the public frontend URL is a fallback, the service role key never is', () => {
  setEnv({ VITE_SUPABASE_URL: 'https://abcdefgh.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon' })
  assert.equal(supabaseUrl(), 'https://abcdefgh.supabase.co')
  assert.equal(isDatabaseConfigured(), false)
})

test('Firebase Admin is configured only by a service account, never by a project id', () => {
  setEnv({ VITE_FIREBASE_PROJECT_ID: 'savdopilot-dev' })
  assert.equal(isFirebaseAdminConfigured(), false)

  setEnv({ FIREBASE_SERVICE_ACCOUNT: '{"project_id":"savdopilot-dev"}' })
  assert.equal(isFirebaseAdminConfigured(), true)
})

test('the server project id prefers FIREBASE_PROJECT_ID over the public variable', () => {
  setEnv({ FIREBASE_PROJECT_ID: 'server-project', VITE_FIREBASE_PROJECT_ID: 'browser-project' })
  assert.equal(firebaseProjectId(), 'server-project')

  setEnv({ VITE_FIREBASE_PROJECT_ID: 'browser-project' })
  assert.equal(firebaseProjectId(), 'browser-project')
})

test('the platform admin allowlist trims entries and drops empty ones', () => {
  setEnv({})
  assert.deepEqual(platformAdminUids(), [])

  setEnv({ PLATFORM_ADMIN_UIDS: '   ' })
  assert.deepEqual(platformAdminUids(), [])

  setEnv({ PLATFORM_ADMIN_UIDS: ' ,  , , ' })
  assert.deepEqual(platformAdminUids(), [])

  setEnv({ PLATFORM_ADMIN_UIDS: ' uid-a , , uid-b ,, ' })
  assert.deepEqual(platformAdminUids(), ['uid-a', 'uid-b'])

  // The `.env.example` placeholder is not an administrator.
  setEnv({ PLATFORM_ADMIN_UIDS: 'your-firebase-uid' })
  assert.deepEqual(platformAdminUids(), [])
})

test('CORS origins come from ALLOWED_ORIGINS, then APP_URL', () => {
  setEnv({ ALLOWED_ORIGINS: 'https://a.example, https://b.example' })
  assert.deepEqual(corsAllowedOrigins(), ['https://a.example', 'https://b.example'])

  setEnv({ APP_URL: 'https://app.example' })
  assert.deepEqual(corsAllowedOrigins(), ['https://app.example'])
})

test('an unconfigured AI provider resolves to null instead of a placeholder call', () => {
  setEnv({})
  assert.equal(resolveAiConfig(), null)

  setEnv({ AI_PROVIDER: 'anthropic', AI_API_KEY: 'test-key' })
  const config = resolveAiConfig()
  assert.equal(config?.baseUrl, 'https://api.anthropic.com/v1')
  assert.equal(config?.apiKey, 'test-key')

  setEnv({ AI_PROVIDER: 'omniroute', OMNIROUTE_API_KEY: 'test-key' })
  assert.equal(resolveAiConfig()?.baseUrl, 'https://api.omniroute.ai/v1')
})

test('a payment provider is usable only with the credentials its webhook reads', () => {
  setEnv({})
  assert.equal(paymentCredentials('click'), null)
  assert.equal(paymentCredentials('stripe'), null)

  // CLICK needs both halves of its MD5 signature input.
  setEnv({ CLICK_SERVICE_ID: 'service-1' })
  assert.equal(paymentCredentials('click'), null)

  setEnv({ CLICK_SERVICE_ID: 'service-1', CLICK_SECRET_KEY: 'secret' })
  assert.deepEqual(paymentCredentials('click'), { serviceId: 'service-1', secret: 'secret' })

  setEnv({ STRIPE_WEBHOOK_SECRET: 'whsec_test' })
  assert.deepEqual(paymentCredentials('stripe'), { webhookSecret: 'whsec_test' })
})
