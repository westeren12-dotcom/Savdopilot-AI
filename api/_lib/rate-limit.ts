/**
 * Rate limiting.
 *
 * LIMITATION (documented in BACKEND_SETUP.md): this is an in-memory fixed
 * window, so the effective limit is `limit x number of warm serverless
 * instances`. It raises the cost of brute force and accidental loops but is
 * not a global quota. `setRateLimitStore` lets you swap in Redis/Upstash
 * without touching call sites.
 */

type Bucket = { count: number; resetAt: number }

export type RateLimitResult = {
  ok: boolean
  limit: number
  remaining: number
  retryAfterSeconds: number
}

export type RateLimitStore = {
  hit(key: string, windowMs: number): { count: number; resetAt: number }
  reset(key: string): void
}

function createMemoryStore(): RateLimitStore {
  const buckets = new Map<string, Bucket>()
  let lastSweep = Date.now()

  return {
    hit(key, windowMs) {
      const now = Date.now()
      // Periodic sweep so the map cannot grow without bound.
      if (now - lastSweep > 60_000) {
        lastSweep = now
        buckets.forEach((bucket, bucketKey) => {
          if (bucket.resetAt <= now) buckets.delete(bucketKey)
        })
      }
      const existing = buckets.get(key)
      if (!existing || existing.resetAt <= now) {
        const fresh = { count: 1, resetAt: now + windowMs }
        buckets.set(key, fresh)
        return fresh
      }
      existing.count += 1
      return existing
    },
    reset(key) {
      buckets.delete(key)
    },
  }
}

let store: RateLimitStore = createMemoryStore()

export function setRateLimitStore(next: RateLimitStore): void {
  store = next
}

export function resetRateLimits(): void {
  store = createMemoryStore()
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const bucket = store.hit(key, windowMs)
  const remaining = Math.max(0, limit - bucket.count)
  return {
    ok: bucket.count <= limit,
    limit,
    remaining,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000)),
  }
}

export const RATE_LIMITS = {
  /** Per organization, per minute — protects AI spend. */
  ai: { limit: 20, windowMs: 60_000 },
  /** Per IP, per minute — protects the session bootstrap + auth probing. */
  auth: { limit: 30, windowMs: 60_000 },
  /** Per IP, per minute — covers provider callbacks and payment retries. */
  payments: { limit: 120, windowMs: 60_000 },
  /** Default for data endpoints. */
  data: { limit: 120, windowMs: 60_000 },
} as const
