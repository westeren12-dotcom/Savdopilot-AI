import { PLAN_LIMITS } from '@/config/plans'
import type { PlanCode } from '@/types'

export interface CreditSnapshot {
  used: number
  limit: number
  remaining: number
  extra: number
}

export function snapshot(used: number, plan: PlanCode, extra: number): CreditSnapshot {
  const limit = PLAN_LIMITS[plan].aiMessages + extra
  const remaining = Math.max(0, limit - used)
  return { used, limit, remaining, extra }
}

export function canSpend(snap: CreditSnapshot, amount = 1): boolean {
  return snap.remaining >= amount
}

export const LIMIT_MESSAGE =
  'AI limit tugadi. Qo‘shimcha AI credits sotib oling yoki tarifni upgrade qiling.'
