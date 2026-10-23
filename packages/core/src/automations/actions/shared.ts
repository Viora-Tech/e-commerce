/** SOURCE OF TRUTH: shared automation action helpers — WHAT: host deps the external executors need, subject/customer lookups, tag planning, order timeline notes, the loop-guard stamp for events core services write, and the one-row-per-step message claim / WHY: every executor in `actions/**` must treat ids, tags, idempotency and loop protection the same way. Server-only. Design §8.4–8.5. */
import { marketingMessage, order, orderNote, outboxEvent, type StoreTx } from '@commerce/db'
import type { NotificationRegistry } from '@commerce/notifications'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { LookupAll } from '../../net/safe-fetch'
import type { RateLimitStore } from '../../rate-limit/limiter'
import { type ActionContext, AutomationActionError } from '../executor'

/** What the worker (or API) hands the built-in executors: the same as Growth's `MarketingDeps`. */
export type BuiltinActionDeps = {
  registry: NotificationRegistry
  settingsSecret: string
  /** Platform storefront URL, the fallback for links when a store has no live domain. */
  storefrontUrl: string
  /** HTTP action only: injected in tests. */
  fetch?: typeof fetch | undefined
  /** HTTP action only: DNS lookup for the SSRF guard; injected in tests. */
  lookup?: LookupAll | undefined
  /** HTTP action only: per-store request rate (10/s); without one only concurrency is capped. */
  rateLimit?: RateLimitStore | undefined
}

/** Author of the timeline notes automations write on orders. */
export const AUTOMATION_AUTHOR = 'automations'

/** The run's subject id, or a non-retryable failure (a subject-free run cannot tag an order). */
export function subjectId(ctx: ActionContext, what: string): string {
  if (!ctx.subject.id) {
    throw new AutomationActionError(`This step needs ${what}`, { retryable: false })
  }
  return ctx.subject.id
}

/** "the order's", "the customer's": a record the step expected is gone. */
export const gone = (what: string) =>
  new AutomationActionError(`The ${what} no longer exists`, {
    retryable: false,
    code: 'AUTOMATION_SUBJECT_MISSING',
  })

/** Tags from config, merge tags filled, trimmed, deduplicated ignoring case. */
export function renderTags(ctx: ActionContext, tags: readonly string[], lowerCase = false) {
  const out = new Map<string, string>()
  for (const raw of tags) {
    const t = ctx.render(raw).trim().slice(0, 40)
    if (t) out.set(t.toLowerCase(), lowerCase ? t.toLowerCase() : t)
  }
  return [...out.values()]
}

export type TagPlan = { next: string[]; changed: string[]; unchanged: string[] }

/** Adding or removing tags, matched without regard to case; `max` caps an add. */
export function planTags(
  current: readonly string[],
  wanted: readonly string[],
  mode: 'add' | 'remove',
  max = Number.POSITIVE_INFINITY,
): TagPlan {
  const have = new Set(current.map((t) => t.toLowerCase()))
  if (mode === 'add') {
    const room = Math.max(0, max - current.length)
    const missing = wanted.filter((t) => !have.has(t.toLowerCase()))
    const changed = missing.slice(0, room)
    return {
      next: [...current, ...changed],
      changed,
      unchanged: wanted.filter((t) => have.has(t.toLowerCase())),
    }
  }
  const drop = new Set(wanted.map((t) => t.toLowerCase()))
  const changed = current.filter((t) => drop.has(t.toLowerCase()))
  return {
    next: current.filter((t) => !drop.has(t.toLowerCase())),
    changed,
    unchanged: wanted.filter((t) => !have.has(t.toLowerCase())),
  }
}

/** Shared dry-run wording for tag steps. */
export function tagPreview(plan: TagPlan, mode: 'add' | 'remove') {
  const verb = mode === 'add' ? 'add' : 'remove'
  const parts = [
    plan.changed.length
      ? `Would ${verb} tags ${plan.changed.join(', ')}.`
      : `Would ${verb} no tags.`,
    plan.unchanged.length
      ? `${mode === 'add' ? 'Already has' : 'Does not have'} ${plan.unchanged.join(', ')}.`
      : '',
  ]
  return {
    summary: parts.filter(Boolean).join(' '),
    wouldRun: plan.changed.length > 0,
    output: { tags: plan.changed },
  }
}

/** A line on the order's timeline: "Tag VIP added by automation High-value orders". */
export async function noteOnOrder(
  tx: StoreTx,
  ctx: ActionContext,
  orderId: string,
  what: string,
): Promise<void> {
  const name = ctx.workflow.name ? ` ${ctx.workflow.name}` : ''
  await tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId,
    body: `${what} by automation${name}`,
    author: AUTOMATION_AUTHOR,
  })
}

/** The order a preview reads (no lock: a dry run may be read-only). */
export async function orderRow(tx: StoreTx, id: string) {
  const [o] = await tx.select().from(order).where(eq(order.id, id))
  return o ?? null
}

/** The order a step is about, locked for the change (null when gone). */
export async function lockedOrder(tx: StoreTx, id: string) {
  const [o] = await tx.select().from(order).where(eq(order.id, id)).for('update')
  return o ?? null
}

/**
 * Core services (cancel, fulfil) write their own outbox events without an automation cause.
 * This stamps the cause on every event this transaction wrote (`created_at` is the
 * transaction's `now()`), so the trigger job's loop guard sees them (design §8.5).
 */
export async function stampCause(tx: StoreTx, ctx: ActionContext): Promise<void> {
  if (!ctx.cause) return
  await tx
    .update(outboxEvent)
    .set({
      payload: sql`${outboxEvent.payload} || jsonb_build_object('automation', ${JSON.stringify(ctx.cause)}::jsonb)`,
    })
    .where(
      and(
        eq(outboxEvent.createdAt, sql`now()`),
        isNull(outboxEvent.dispatchedAt),
        sql`not (${outboxEvent.payload} ? 'automation')`,
      ),
    )
}

export type ClaimedMessage = { id: string; alreadySent: boolean }

/**
 * One `marketing_message` row per run step (unique `(automation_run_id, automation_node_id)`):
 * a retried step finds its row and does not send twice once it went out.
 */
export async function claimMessage(
  tx: StoreTx,
  ctx: ActionContext,
  input: { channel: string; to: string; customerId: string | null },
): Promise<ClaimedMessage> {
  const runId = ctx.runId
  if (!runId) throw new AutomationActionError('A dry run sends nothing', { retryable: false })
  const [row] = await tx
    .insert(marketingMessage)
    .values({
      storeId: ctx.storeId,
      automationRunId: runId,
      automationNodeId: ctx.nodeId,
      customerId: input.customerId,
      channel: input.channel,
      to: input.to.slice(0, 500),
    })
    .onConflictDoNothing()
    .returning({ id: marketingMessage.id })
  if (row) return { id: row.id, alreadySent: false }
  const [existing] = await tx
    .select({ id: marketingMessage.id, status: marketingMessage.status })
    .from(marketingMessage)
    .where(
      and(
        eq(marketingMessage.automationRunId, runId),
        eq(marketingMessage.automationNodeId, ctx.nodeId),
      ),
    )
  if (!existing) throw new AutomationActionError('Message row vanished', { retryable: true })
  return { id: existing.id, alreadySent: existing.status === 'sent' }
}

/** Marks a claimed message row (staff alerts, which `marketing/send.ts` does not record). */
export async function recordMessage(
  tx: StoreTx,
  id: string,
  result: { ok: boolean; channel: string; error?: string | undefined; providerRef?: string },
): Promise<void> {
  await tx
    .update(marketingMessage)
    .set({
      channel: result.channel,
      status: result.ok ? 'sent' : 'failed',
      providerRef: result.ok ? (result.providerRef ?? null) : null,
      error: result.ok ? null : (result.error ?? 'failed').slice(0, 500),
      sentAt: result.ok ? new Date() : null,
    })
    .where(eq(marketingMessage.id, id))
}

/** A provider said no: retryable when it says the provider (not the message) failed. */
export function sendFailure(error: string, retryable: boolean | undefined) {
  return new AutomationActionError(`Could not send: ${error.slice(0, 300)}`, {
    retryable: retryable !== false,
    code: 'AUTOMATION_SEND_FAILED',
  })
}
