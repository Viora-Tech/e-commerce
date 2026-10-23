/** SOURCE OF TRUTH: automation executor contract — WHAT: the interface every action executor (built-in `actions/**` or plugin) and the condition evaluator implement, and the context the interpreter hands them / WHY: the engine runs pieces only through this seam, so executors are written in parallel without touching the interpreter. Server-only (types reference the DB transaction). Design §8.4–8.5. */
import type { StoreTx } from '@commerce/db'
import { CommerceError } from '../errors'
import type { RuleGroup } from './definition'
import type { AutomationCause, RecordRef, SubjectType } from './types'

/** The data conditions and merge tags read: `{ order: {...} }`, `{ customer: {...} }`… */
export type SubjectData = Record<string, unknown>

/** Who a run is about. `id` is null for subject-free runs (schedules). */
export type RunSubject = { type: SubjectType; id: string | null }

/** Everything an executor may know about the run it is part of. */
export type ActionContext = {
  storeId: string
  workflow: { id: string; name: string; versionId: string }
  /** `null` in a dry run (no run row exists). */
  runId: string | null
  nodeId: string
  /**
   * Idempotency key for this step: `<runId>:<nodeId>:<iteration>`. External actions pass it to
   * their provider (email/WhatsApp message key, HTTP `Idempotency-Key`, plugin `stepRunId`).
   */
  stepKey: string
  attempt: number
  subject: RunSubject
  /** Fresh subject data, loaded when the step started (not the trigger snapshot). */
  data: SubjectData
  /** The trigger event's snapshot (`automation_run.trigger_data`). */
  triggerData: Record<string, unknown>
  /**
   * Pass to `insertOutboxEvent(..., { cause })` for every event the action writes, so the
   * trigger job can stop loops (design §8.5 loop protection).
   */
  cause: AutomationCause | null
  /** True in "Test with a record": `preview` is called, never `run`. */
  dryRun: boolean
  /** Fills `{order.number}`-style merge tags from `data`. Unknown tags become empty. */
  render(template: string): string
  log(message: string): void
}

/**
 * Internal actions get the run's `withStore` transaction: the effect and the step-run row
 * commit together (exactly once). External actions get `tx` too but must assume at-least-once
 * and key their side effect by `ctx.stepKey`.
 */
export type ActionRunInput<C> = { tx: StoreTx; ctx: ActionContext; config: C }

export type ActionResult = {
  /** Stored in `automation_step_run.output` (truncated to 8 KB). Secrets must not appear. */
  output?: Record<string, unknown> | undefined
  /** Records the action changed besides the subject, for record history. */
  changed?: RecordRef[] | undefined
  /** A few words for the run log, e.g. "Added tags VIP, High value". */
  summary?: string | undefined
  /** True when the action changed nothing (tag already there); no timeline entry is written. */
  noop?: boolean | undefined
}

/** What a dry run says the action would do: "Would add tags VIP. Already has High value." */
export type ActionPreview = {
  summary: string
  /** Shown as a warning in the test result (missing WhatsApp template, no consent…). */
  warnings?: string[] | undefined
  /** False when the action could not run on this record (order already cancelled). */
  wouldRun: boolean
  output?: Record<string, unknown> | undefined
}

/**
 * Throw from `run` to fail a step. `retryable: true` (timeouts, 429/5xx, DB lock) is retried
 * with backoff; `false` (order already cancelled, 4xx) fails the step at once.
 */
export class AutomationActionError extends CommerceError {
  readonly retryable: boolean
  /** Ms to wait before the next try, e.g. from a 429's Retry-After. */
  readonly retryAfterMs: number | undefined

  constructor(
    message: string,
    opts: { retryable: boolean; code?: string; retryAfterMs?: number; cause?: unknown } = {
      retryable: false,
    },
  ) {
    super(opts.code ?? 'AUTOMATION_ACTION_FAILED', message, { cause: opts.cause })
    this.retryable = opts.retryable
    this.retryAfterMs = opts.retryAfterMs
  }
}

/** One action's server half, registered under its catalogue id. */
export type ActionExecutor<C = Record<string, unknown>> = {
  id: string
  run(input: ActionRunInput<C>): Promise<ActionResult>
  preview(input: ActionRunInput<C>): Promise<ActionPreview>
  /**
   * Optional two-phase form for slow outbound calls (HTTP): `prepare` reads what the call needs
   * in a short transaction, `send` makes the call with no transaction open, and the engine
   * records the result in another short one. Without it, an external action's `run` gets its
   * own short transaction, never the run's lock (design §8.5).
   */
  prepare?: ((input: ActionRunInput<C>) => Promise<unknown>) | undefined
  send?: ((prepared: unknown, ctx: ActionContext, config: C) => Promise<ActionResult>) | undefined
}

/** Loads the data a subject's conditions and merge tags read; null when the record is gone. */
export type SubjectLoader = (
  tx: StoreTx,
  storeId: string,
  subject: RunSubject,
) => Promise<SubjectData | null>

/** One evaluated rule, for the run log ("Order total ₹2,450 > ₹2,000: yes"). */
export type RuleTrace = {
  field: string
  op: string
  expected: unknown
  actual: unknown
  pass: boolean
}

export type ConditionResult = { pass: boolean; trace: RuleTrace[] }

/** Evaluates a rule group over subject data. Pure, so the dry run and the worker agree. */
export type ConditionEvaluator = (rules: RuleGroup, data: SubjectData) => ConditionResult
