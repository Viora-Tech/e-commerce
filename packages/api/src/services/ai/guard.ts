/**
 * The gate every AI call goes through, in order: is AI configured on this platform, is the
 * feature on for the store, is the store inside its rate limit and monthly quota. Then the
 * call is counted, and its tokens are added when the model reports them.
 *
 * Adding an AI feature never re-implements this: call `startAiCall(context, 'myFeature')`,
 * run the engine with the runtime and model it returns, then `finishAiCall`.
 */
import {
  type AiFeature,
  type AiModel,
  type AiPlan,
  type AiRuntime,
  type AiUsage,
  aiModel,
  aiMonth,
  checkQuota,
  isUnlimitedStore,
} from '@commerce/ai'
import {
  aiUsageForMonth,
  checkRateLimit,
  createMemoryRateLimitStore,
  loadAiSettings,
  type RateLimitRule,
  type RateLimitStore,
  rateLimitKey,
  recordAiUsage,
  retryAfterSeconds,
  type StoreContext,
} from '@commerce/core'
import { formatInZone } from '@commerce/dates'
import { type Db, type StoreTx, store, withStore } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { eq } from 'drizzle-orm'
import type { StoreScope } from '../../procedures'

/** Burst limit per store across every AI feature: plenty for a person, tight for a script. */
const AI_RATE_LIMIT: RateLimitRule = { limit: 20, windowMs: 5 * 60_000 }

const fallback = createMemoryRateLimitStore()

export type AiCallContext = {
  db: Db
  scope: StoreScope
  rateLimit?: RateLimitStore | undefined
}

export type StoreFacts = { name: string; slug: string; currency: string; timezone: string }

/** The store row bits AI features need (name for prompts, slug for the unlimited list). */
export async function storeFacts(tx: StoreTx, storeId: string): Promise<StoreFacts> {
  const [row] = await tx
    .select({
      name: store.name,
      slug: store.slug,
      currency: store.currency,
      timezone: store.timezone,
    })
    .from(store)
    .where(eq(store.id, storeId))
  return row ?? { name: 'your store', slug: '', currency: 'INR', timezone: 'Asia/Kolkata' }
}

/** The plan that applies: the platform's own stores (AI_UNLIMITED_STORES) are unlimited. */
export function effectivePlan(slug: string, stored: AiPlan): AiPlan {
  return slug && isUnlimitedStore(slug) ? 'unlimited' : stored
}

const nextMonthLabel = (month: string): string => {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const next = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1))
  return formatInZone(next, { month: 'long' }, { timeZone: 'UTC' })
}

export type StartedAiCall = {
  runtime: AiRuntime
  model: AiModel
  month: string
  store: StoreFacts
}

/**
 * Checks and counts one AI call for the caller's store. Throws a plain-language ORPCError when
 * AI is off, the feature is off, or the store is over its rate limit or monthly quota.
 */
export async function startAiCall(
  context: AiCallContext,
  feature: AiFeature,
): Promise<StartedAiCall> {
  const { storeId, userId } = context.scope
  const model = aiModel(feature)
  if (!model) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: 'AI features are not switched on for this platform yet.',
      data: { reason: 'ai_off' },
    })
  }
  const limit = await checkRateLimit(
    context.rateLimit ?? fallback,
    rateLimitKey('ai', storeId),
    AI_RATE_LIMIT,
  )
  if (!limit.ok) {
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds(limit) / 60))
    throw new ORPCError('TOO_MANY_REQUESTS', {
      message: `That is a lot of AI requests in a few minutes. Try again in about ${minutes} minute(s).`,
      data: { reason: 'rate_limit', retryAfterSeconds: retryAfterSeconds(limit) },
    })
  }
  const month = aiMonth()
  return withStore(context.db, storeId, async (tx) => {
    const ctx: StoreContext = { storeId, tx }
    const settings = await loadAiSettings(ctx)
    const facts = await storeFacts(tx, storeId)
    if (!settings.features[feature]) {
      throw new ORPCError('PRECONDITION_FAILED', {
        message: 'This AI feature is turned off for your store. Turn it on in Settings → AI.',
        data: { reason: 'feature_off' },
      })
    }
    const plan = effectivePlan(facts.slug, settings.plan)
    const used = await aiUsageForMonth(ctx, month)
    const quota = checkQuota(plan, used.total)
    if (!quota.ok) {
      throw new ORPCError('TOO_MANY_REQUESTS', {
        message: `Your store has used this month's AI allowance. It starts again on 1 ${nextMonthLabel(month)}.`,
        data: { reason: 'quota', limit: quota.reason },
      })
    }
    await recordAiUsage(ctx, { month, feature, calls: 1 })
    return { runtime: { storeId, userId, plan, feature }, model, month, store: facts }
  })
}

/** Adds the call's tokens to the store's month. Never throws: metering must not break an answer. */
export async function finishAiCall(
  db: Db,
  call: Pick<StartedAiCall, 'runtime' | 'month'>,
  usage: AiUsage,
): Promise<void> {
  if (usage.inputTokens === 0 && usage.outputTokens === 0) return
  await withStore(db, call.runtime.storeId, (tx) =>
    recordAiUsage(
      { storeId: call.runtime.storeId, tx },
      { month: call.month, feature: call.runtime.feature, ...usage },
    ),
  ).catch(() => undefined)
}
