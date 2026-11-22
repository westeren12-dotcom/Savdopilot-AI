import { createPublicHandler } from './_lib/handler.js'
import { getDb } from './_lib/supabase.js'
import {
  apiVersion,
  paymentCredentials,
  resolveAiConfig,
  supabaseConfigStatus,
} from './_lib/env.js'
import { firebaseAuthStatus } from './_lib/auth.js'

function authCheck(): 'configured' | 'not_configured' | 'invalid' | 'misconfigured' {
  switch (firebaseAuthStatus()) {
    case 'ok':
      return 'configured'
    case 'missing':
      return 'not_configured'
    case 'invalid':
      return 'invalid'
    default:
      // A parseable service account whose project id disagrees with
      // FIREBASE_PROJECT_ID / VITE_FIREBASE_PROJECT_ID.
      return 'misconfigured'
  }
}

/**
 * GET /api/health
 *
 * Public, unauthenticated liveness/readiness probe. It reports which
 * integrations are configured — never their values — so a deployment can be
 * diagnosed without exposing secrets.
 */
export default createPublicHandler({
  methods: ['GET'],
  handler: async () => {
    const config = supabaseConfigStatus()
    let database: 'ok' | 'not_configured' | 'invalid_url' | 'unreachable' = config
    if (config === 'ok') {
      try {
        const { error } = await getDb().from('organizations').select('id').limit(1)
        database = error ? 'unreachable' : 'ok'
      } catch {
        database = 'unreachable'
      }
    }

    return {
      body: {
        status: 'ok',
        service: 'savdopilot-api',
        version: apiVersion(),
        time: new Date().toISOString(),
        checks: {
          database,
          auth: authCheck(),
          ai: resolveAiConfig() ? 'configured' : 'not_configured',
          payments: {
            click: Boolean(paymentCredentials('click')),
            payme: Boolean(paymentCredentials('payme')),
            uzum: Boolean(paymentCredentials('uzum')),
            stripe: Boolean(paymentCredentials('stripe')),
          },
        },
      },
    }
  },
})
