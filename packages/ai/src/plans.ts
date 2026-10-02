/**
 * SOURCE OF TRUTH: AI plans, monthly quotas, the AI usage month — WHAT how much AI each store
 * may use per month / WHY one place to change a limit, shared by the API guard and the
 * Settings → AI page. Pure and client-safe (no SDK, no env).
 */
import { dayKey } from '@commerce/dates'

export const AI_PLANS = ['free', 'starter', 'growth', 'unlimited'] as const
export type AiPlan = (typeof AI_PLANS)[number]

/** What a new store gets until billing sets another plan. */
export const DEFAULT_AI_PLAN: AiPlan = 'starter'

/** Per store, per calendar month (IST). `null` means no limit. */
export type AiQuota = { calls: number | null; tokens: number | null }

/**
 * Sized from the default model (Claude Haiku 4.5 at $1 in / $5 out per million tokens): a
 * product write is ~5k tokens (~₹0.8), a store question ~8k (~₹0.9). Starter's ceiling is
 * about ₹130 of model cost a month; tokens cap the rare long call, calls cap everything else.
 */
export const PLAN_QUOTAS: Record<AiPlan, AiQuota> = {
  free: { calls: 30, tokens: 150_000 },
  starter: { calls: 300, tokens: 1_500_000 },
  growth: { calls: 2_000, tokens: 10_000_000 },
  unlimited: { calls: null, tokens: null },
}

export type AiUsageTotals = { calls: number; inputTokens: number; outputTokens: number }

export type QuotaCheck = { ok: true } | { ok: false; reason: 'calls' | 'tokens' }

/** Whether a store on `plan` that has used `used` this month may make one more call. */
export function checkQuota(plan: AiPlan, used: AiUsageTotals): QuotaCheck {
  const quota = PLAN_QUOTAS[plan]
  if (quota.calls !== null && used.calls >= quota.calls) return { ok: false, reason: 'calls' }
  if (quota.tokens !== null && used.inputTokens + used.outputTokens >= quota.tokens) {
    return { ok: false, reason: 'tokens' }
  }
  return { ok: true }
}

/** The usage bucket a moment falls in: its calendar month in India, `YYYY-MM`. */
export function aiMonth(at: Date = new Date()): string {
  return dayKey(at).slice(0, 7)
}

/** Narrows a stored value to a plan, falling back to the default. */
export function parseAiPlan(value: unknown): AiPlan {
  return AI_PLANS.includes(value as AiPlan) ? (value as AiPlan) : DEFAULT_AI_PLAN
}
