/**
 * GET /api/stats
 *
 * Its own Vercel Function (the eighth; Hobby allows twelve) because the URL is
 * the file path — no rewrite entry is needed.
 *
 * Authentication, tenant resolution, rate limiting, CORS and error handling all
 * stay inside the createHandler pipeline of the route module.
 */
export { default } from './_lib/routes/stats.js'
