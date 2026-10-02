/**
 * The gate every AI call from a request goes through, in order: is AI configured on this
 * platform, is the store inside its burst rate limit, is the feature on for the store, is it
 * inside its monthly quota. Then the call is counted, and its tokens are added when the model
 * reports them. The feature, plan and quota part is core's `admitAiCall`, shared with the
 * worker's bulk runs.
 *
 * Adding an AI feature never re-implements this: call `startAiCall(context, 'myFeature')`,
 * run the engine with the runtime and model it returns, then `finishAiCall`.
 */
import { type AiFeature, type AiModel, type AiRuntime, type AiUsage, aiModel } from '@commerce/ai'
import {
  checkRateLimit,
  createMemoryRateLimitStore,
  type RateLimitRule,
  type RateLimitStore,
  rateLimitKey,
  recordAiUsage,
  retryAfterSeconds,
} from '@commerce/core'
import { type AiStoreFacts, admitAiCall } from '@commerce/core/ai-runtime'
import { formatInZone } from '@commerce/dates'
import { type Db, withStore } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import type { StoreScope } from '../../procedures'

/** Burst limit per store across every AI feature: plenty for a person, tight for a script. */
const AI_RATE_LIMIT: RateLimitRule = { limit: 20, windowMs: 5 * 60_000 }

const fallback = createMemoryRateLimitStore()

export type AiCallContext = {
  db: Db
  scope: StoreScope
  rateLimit?: RateLimitStore | undefined
}

export type StoreFacts = AiStoreFacts

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

/** Refuses with a plain-language reason when AI is off or the store is over its burst limit. */
export async function checkAiAvailable(context: AiCallContext): Promise<void> {
  if (!aiModel('assistant')) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: 'AI features are not switched on for this platform yet.',
      data: { reason: 'ai_off' },
    })
  }
  const limit = await checkRateLimit(
    context.rateLimit ?? fallback,
    rateLimitKey('ai', context.scope.storeId),
    AI_RATE_LIMIT,
  )
  if (!limit.ok) {
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds(limit) / 60))
    throw new ORPCError('TOO_MANY_REQUESTS', {
      message: `That is a lot of AI requests in a few minutes. Try again in about ${minutes} minute(s).`,
      data: { reason: 'rate_limit', retryAfterSeconds: retryAfterSeconds(limit) },
    })
  }
}

/** The plain-language refusal for a call core did not admit. */
export function refusal(
  admission:
    | { reason: 'feature_off' }
    | { reason: 'quota'; limit: 'calls' | 'tokens'; month: string },
): ORPCError<string, unknown> {
  if (admission.reason === 'feature_off') {
    return new ORPCError('PRECONDITION_FAILED', {
      message: 'This AI feature is turned off for your store. Turn it on in Settings → AI.',
      data: { reason: 'feature_off' },
    })
  }
  return new ORPCError('TOO_MANY_REQUESTS', {
    message: `Your store has used this month's AI allowance. It starts again on 1 ${nextMonthLabel(admission.month)}.`,
    data: { reason: 'quota', limit: admission.limit },
  })
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
  await checkAiAvailable(context)
  const admission = await withStore(context.db, storeId, (tx) =>
    admitAiCall({ storeId, tx }, feature),
  )
  if (!admission.ok) throw refusal(admission)
  const model = aiModel(feature, process.env, admission.tier)
  if (!model) throw new ORPCError('PRECONDITION_FAILED', { data: { reason: 'ai_off' } })
  return {
    runtime: { storeId, userId, plan: admission.plan, feature },
    model,
    month: admission.month,
    store: admission.store,
  }
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
