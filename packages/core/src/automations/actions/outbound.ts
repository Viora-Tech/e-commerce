/** SOURCE OF TRUTH: outbound message steps in two phases — WHAT: the shape every email and WhatsApp action plans in (a claimed message row plus the provider messages, or a result with nothing to send), sending with no transaction open, and recording the outcome on the message row / WHY: a provider call must never hold a database transaction (design §8.5); one implementation keeps the once-per-step `marketing_message` guarantee for every message action. Server-only. */
import type { StoreTx } from '@commerce/db'
import type { MarketingSend, NotificationChannel, SendResult } from '@commerce/notifications'
import { deliverMarketing } from '../../marketing/send'
import {
  type ActionExecutor,
  type ActionPreview,
  type ActionResult,
  type ActionRunInput,
  AutomationActionError,
} from '../executor'
import { recordMessage, sendFailure } from './shared'

/** What a message step will do once its transaction has committed. */
export type Planned =
  | { kind: 'result'; result: ActionResult }
  | {
      kind: 'send'
      /** The step's `marketing_message` row (claimed, so a retry never sends twice). */
      messageId: string
      channel: NotificationChannel
      messages: MarketingSend[]
      /** The step's result when every message went out. */
      done: ActionResult
      /** Extra writes after a successful send, in the recording transaction. */
      after?: ((tx: StoreTx) => Promise<void>) | undefined
      /** A provider-side check before sending (template approved?); a reason refuses the send. */
      check?: (() => Promise<string | null>) | undefined
    }

type Sent = { results: SendResult[] } | { refused: string } | null

/** Sends each message in turn, stopping at the first refusal. No database is touched. */
async function sendPlanned(plan: Planned): Promise<Sent> {
  if (plan.kind === 'result') return null
  const refused = plan.check ? await plan.check() : null
  if (refused) return { refused }
  const results: SendResult[] = []
  for (const m of plan.messages) {
    const r = await deliverMarketing(plan.channel, m)
    results.push(r)
    if (!r.ok) break
  }
  return { results }
}

/** Records the outcome on the message row; a refusal fails the step (retried when transient). */
async function recordPlanned(tx: StoreTx, plan: Planned, sent: Sent): Promise<ActionResult> {
  if (plan.kind === 'result') return plan.result
  if (sent && 'refused' in sent) {
    await recordMessage(tx, plan.messageId, {
      ok: false,
      channel: plan.channel.id,
      error: sent.refused,
    })
    throw new AutomationActionError(sent.refused, { retryable: false })
  }
  const results = sent?.results ?? []
  const failed = results.find((r) => !r.ok)
  if (failed && !failed.ok) {
    await recordMessage(tx, plan.messageId, {
      ok: false,
      channel: plan.channel.id,
      error: failed.error,
    })
    throw sendFailure(failed.error, failed.retryable)
  }
  const last = results.at(-1)
  await recordMessage(tx, plan.messageId, {
    ok: true,
    channel: plan.channel.id,
    providerRef: last?.ok ? last.providerRef : '',
  })
  await plan.after?.(tx)
  return plan.done
}

/**
 * A message action from its plan and preview: `prepare` plans (reads, consent, claims the
 * row), `send` calls the provider with nothing open, `record` writes the outcome. `run` does
 * all three in one transaction, for callers without the engine's phases (tests, scripts).
 */
export function messageExecutor<C>(
  id: string,
  plan: (input: ActionRunInput<C>) => Promise<Planned>,
  preview: (input: ActionRunInput<C>) => Promise<ActionPreview>,
): ActionExecutor<C> {
  return {
    id,
    prepare: plan,
    send: (prepared) => sendPlanned(prepared as Planned),
    record: ({ tx }, prepared, sent) => recordPlanned(tx, prepared as Planned, sent as Sent),
    async run(input) {
      const p = await plan(input)
      return recordPlanned(input.tx, p, await sendPlanned(p))
    },
    preview,
  }
}
