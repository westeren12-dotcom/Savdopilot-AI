import { useCallback, useEffect, useState } from 'react'
import { ApiClientError, api, type OrgStatsResponse } from '@/lib/api-client'
import { env } from '@/config/env'

/**
 * Live organization statistics for the dashboard.
 *
 * In demo mode it reports `demo` and the caller keeps the seeded numbers, so a
 * demo total is never shown as a live one. In real mode every state is explicit:
 * loading, ready (which may legitimately be all zeroes) and error.
 */
export type OrgStatsState =
  | { status: 'demo' }
  | { status: 'loading' }
  | { status: 'ready'; data: OrgStatsResponse }
  | { status: 'error'; message: string }

function messageFor(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 401) return 'Sessiya tasdiqlanmadi — qayta kiring.'
    if (err.status === 403) return 'Bu ma’lumotni ko‘rishga ruxsat yo‘q.'
    if (err.status === 503) return 'Statistika xizmati hali sozlanmagan.'
  }
  return 'Statistikani yuklab bo‘lmadi.'
}

export function useOrgStats(): { state: OrgStatsState; reload: () => void } {
  const [state, setState] = useState<OrgStatsState>(
    env.useDemoMode ? { status: 'demo' } : { status: 'loading' },
  )
  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => {
    setState(env.useDemoMode ? { status: 'demo' } : { status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    // Demo mode is fixed for the lifetime of the bundle, so the initial state
    // above already covers it and no request is ever made.
    if (env.useDemoMode) return
    let cancelled = false
    api
      .stats()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: 'error', message: messageFor(err) })
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  return { state, reload }
}
