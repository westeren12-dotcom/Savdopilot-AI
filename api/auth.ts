/**
 * POST|GET /api/auth/session
 *
 * The URL is preserved by a rewrite in vercel.json (`/api/auth/session` ->
 * `/api/auth`), so the public API surface does not change while this domain
 * occupies a single Vercel Function.
 */
export { default } from './_lib/routes/session.js'
