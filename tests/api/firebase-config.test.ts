import assert from 'node:assert/strict'
import test from 'node:test'
import { firebaseAuthStatus, parseFirebaseServiceAccount } from '../../api/_lib/auth'

const PRIVATE_KEY =
  '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----\n'

function serviceAccount(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'service_account',
    project_id: 'savdopilot-dev',
    client_email: 'firebase-adminsdk@savdopilot-dev.iam.gserviceaccount.com',
    private_key: PRIVATE_KEY,
    ...overrides,
  }
}

function setEnv(values: Record<string, string | undefined> = {}): void {
  for (const key of [
    'FIREBASE_SERVICE_ACCOUNT',
    'FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_PROJECT_ID',
  ]) {
    delete process.env[key]
  }
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) process.env[key] = value
  }
}

function messageOf(run: () => unknown): string {
  try {
    run()
  } catch (err) {
    assert.ok(err instanceof Error)
    return err.message
  }
  assert.fail('expected a parse failure')
}

test('plain service-account JSON is accepted', () => {
  const parsed = parseFirebaseServiceAccount(JSON.stringify(serviceAccount()))
  assert.equal(parsed.project_id, 'savdopilot-dev')
  assert.equal(parsed.client_email, 'firebase-adminsdk@savdopilot-dev.iam.gserviceaccount.com')
  assert.ok(parsed.private_key.startsWith('-----BEGIN PRIVATE KEY-----\n'))
  assert.ok(parsed.private_key.endsWith('\n'))
})

test('a base64-encoded service account is accepted (the one-line secret form)', () => {
  const encoded = Buffer.from(
    JSON.stringify(
      serviceAccount({ client_email: 'encoded@savdopilot-dev.iam.gserviceaccount.com' }),
    ),
  ).toString('base64')
  const parsed = parseFirebaseServiceAccount(encoded)
  assert.equal(parsed.client_email, 'encoded@savdopilot-dev.iam.gserviceaccount.com')
  assert.ok(parsed.private_key.includes('\n'))
})

test('literal "\\n" in the private key is turned into real newlines', () => {
  // What a dashboard paste or shell-quoted value produces: the whole PEM on one
  // line with literal backslash-n, which the Admin SDK cannot parse.
  const oneLine = JSON.stringify(
    serviceAccount({ private_key: PRIVATE_KEY.replace(/\n/g, '\\n') }),
  )
  const parsed = parseFirebaseServiceAccount(oneLine)
  assert.ok(parsed.private_key.includes('-----BEGIN PRIVATE KEY-----\nMIIEvQ'))
  assert.ok(!parsed.private_key.includes('\\n'))
  assert.equal(parsed.private_key.split('\n').length, 4)
})

test('CRLF line endings are normalised and a trailing newline is ensured', () => {
  const crlf = PRIVATE_KEY.replace(/\n/g, '\r\n').trimEnd()
  const parsed = parseFirebaseServiceAccount(
    JSON.stringify(serviceAccount({ private_key: crlf })),
  )
  assert.ok(!parsed.private_key.includes('\r'))
  assert.ok(parsed.private_key.endsWith('-----END PRIVATE KEY-----\n'))
})

test('the private key must actually be a PEM private key', () => {
  const message = messageOf(() =>
    parseFirebaseServiceAccount(
      JSON.stringify(serviceAccount({ private_key: 'not-a-key-at-all' })),
    ),
  )
  assert.match(message, /PEM private key/)
})

test('missing required fields fail with a field-specific message', () => {
  assert.match(
    messageOf(() =>
      parseFirebaseServiceAccount(JSON.stringify(serviceAccount({ project_id: '' }))),
    ),
    /project_id/,
  )
  assert.match(
    messageOf(() =>
      parseFirebaseServiceAccount(JSON.stringify(serviceAccount({ client_email: undefined }))),
    ),
    /client_email/,
  )
  assert.match(
    messageOf(() =>
      parseFirebaseServiceAccount(JSON.stringify(serviceAccount({ private_key: undefined }))),
    ),
    /private_key/,
  )
})

test('a non-service-account credential is rejected by name, without echoing the key', () => {
  const message = messageOf(() =>
    parseFirebaseServiceAccount(
      JSON.stringify(serviceAccount({ type: 'authorized_user', private_key: PRIVATE_KEY })),
    ),
  )
  assert.match(message, /authorized_user/)
  assert.ok(!message.includes('MIIEvQIBADANBgkqhkiG9w0BAQEFAASC'))
})

test('malformed input is reported as malformed, not as a missing variable', () => {
  assert.match(messageOf(() => parseFirebaseServiceAccount('')), /not valid JSON/)
  assert.match(
    messageOf(() => parseFirebaseServiceAccount('definitely not base64 json')),
    /not valid JSON/,
  )
  assert.match(messageOf(() => parseFirebaseServiceAccount('[1,2,3]')), /JSON object/)
  assert.match(messageOf(() => parseFirebaseServiceAccount('42')), /JSON object/)
})

test('configuration status distinguishes missing, invalid, mismatch and ok', () => {
  setEnv({})
  assert.equal(firebaseAuthStatus(), 'missing')

  setEnv({ FIREBASE_SERVICE_ACCOUNT: 'nonsense' })
  assert.equal(firebaseAuthStatus(), 'invalid')

  setEnv({
    FIREBASE_SERVICE_ACCOUNT: JSON.stringify(serviceAccount()),
    FIREBASE_PROJECT_ID: 'some-other-project',
  })
  assert.equal(firebaseAuthStatus(), 'project_mismatch')

  setEnv({
    FIREBASE_SERVICE_ACCOUNT: JSON.stringify(serviceAccount()),
    VITE_FIREBASE_PROJECT_ID: 'savdopilot-dev',
  })
  assert.equal(firebaseAuthStatus(), 'ok')

  setEnv({ FIREBASE_SERVICE_ACCOUNT: JSON.stringify(serviceAccount()) })
  assert.equal(firebaseAuthStatus(), 'ok')
})
