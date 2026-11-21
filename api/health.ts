import { createPublicHandler } from './_lib/handler'
import { getDb } from './_lib/supabase'
import { apiVersion, isDatabaseConfigured, isFirebaseAdminConfigured, resolveAiConfig, paymentCredentials } from './_lib/env'

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
    let database = 'not_configured'
    if (isDatabaseConfigured()) {
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
          auth: isFirebaseAdminConfigured() ? 'configured' : 'not_configured',
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
