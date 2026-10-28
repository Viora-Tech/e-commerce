/**
 * SOURCE OF TRUTH: AI plans, monthly quotas, the AI usage month — WHAT how much AI each store
 * may use per month / WHY one place to change a limit, shared by the API guard and the
 * Settings → AI page. Pure and client-safe (no SDK, no env).
 */
import { dayKey } from '@commerce/dates'
import type { ModelTier } from './features'

export const AI_PLANS = ['free', 'starter', 'growth', 'pro', 'scale'] as const
export type AiPlan = (typeof AI_PLANS)[number]

/** What a new store gets until billing sets another plan. */
export const DEFAULT_AI_PLAN: AiPlan = 'starter'

/**
 * Per store, per calendar month (IST). `credits` is the allowance merchants see (1 credit =
 * ₹0.10 of model cost, memory-bank/pricing.md); `calls` and `tokens` stay as safety caps
 * against a runaway client. `null` means no cap.
 */
export type AiQuota = { credits: number; calls: number | null; tokens: number | null }

/**
 * Credits per plan, owner's pricing of 2026-10-28: a store that uses all of them costs exactly
 * `credits × RUPEES_PER_CREDIT` of model cost (₹50 / ₹300 / ₹800 / ₹1,500), whichever model ran.
 * Tokens cap the rare long call, calls cap everything else.
 */
export const PLAN_QUOTAS: Record<AiPlan, AiQuota> = {
  free: { credits: 100, calls: 30, tokens: 150_000 },
  starter: { credits: 500, calls: 1_000, tokens: 5_000_000 },
  growth: { credits: 3_000, calls: 5_000, tokens: 30_000_000 },
  pro: { credits: 8_000, calls: null, tokens: null },
  scale: { credits: 15_000, calls: null, tokens: null },
}

/** `credits` are whole credits used (fractions kept). */
export type AiUsageTotals = {
  calls: number
  inputTokens: number
  outputTokens: number
  credits: number
}

export type QuotaCheck = { ok: true } | { ok: false; reason: 'credits' | 'calls' | 'tokens' }

/**
 * ₹ per million tokens for each tier, from the providers' list prices at ₹85 a dollar
 * (fast: Haiku 5.5 $0.10 in / $0.50 out; strong: Sonnet 4.5 $3 / $15). Update with the model.
 */
export const TIER_PRICES_INR: Record<ModelTier, { input: number; output: number }> = {
  fast: { input: 8.5, output: 42.5 },
  strong: { input: 255, output: 1_275 },
}

/** ₹ of model cost one credit stands for. */
export const RUPEES_PER_CREDIT = 0.1

/** The credits one call's tokens cost, in thousandths of a credit (stored as an integer). */
export function creditMillisFor(tier: ModelTier, inputTokens: number, outputTokens: number) {
  const price = TIER_PRICES_INR[tier]
  const rupees = (inputTokens * price.input + outputTokens * price.output) / 1_000_000
  return Math.ceil((rupees / RUPEES_PER_CREDIT) * 1000)
}

/**
 * Whether a store on `plan` that has used `used` this month may make one more call.
 * `extraCredits` are bought top-ups still left (they carry over until used).
 */
export function checkQuota(plan: AiPlan, used: AiUsageTotals, extraCredits = 0): QuotaCheck {
  const quota = PLAN_QUOTAS[plan]
  if (used.credits >= quota.credits + Math.max(0, extraCredits))
    return { ok: false, reason: 'credits' }
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
