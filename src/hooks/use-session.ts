import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  actions,
  currentBusiness,
  currentProfile,
  getState,
  subscribe,
  usageFor,
  type AppState,
} from '@/store/app-store'

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState)
}

export function useSession() {
  const state = useAppState()
  const profile = currentProfile()
  const business = currentBusiness()
  return { state, profile, business, actions }
}

export function useCredits() {
  const { business } = useSession()
  const state = useAppState()
  if (!business) return { used: 0, limit: 0, remaining: 0, extra: 0, plan: 'free' as const }
  void state
  return usageFor(business.id)
}

export function useNow(intervalMs = 60_000) {
  const [n, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return n
}
