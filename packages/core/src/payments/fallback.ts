/** SOURCE OF TRUTH: gateway fallback loop — WHAT tries the next active gateway when one cannot open a payment / WHY kept free of the database so the order of tries is tested on its own */
import type { OnlineMethodId } from './methods'

/** The answer of one try; the same shape `startPaymentAttempt` returns. */
type Started = {
  attemptId: string
  status: string
  session: unknown
  error: string | null
}

export type FallbackTry<P> = {
  provider: P
  /** What this gateway's window offers; undefined lets it show everything. */
  methods?: OnlineMethodId[] | undefined
}

/**
 * True when the gateway could not open a payment at all (it threw, timed out,
 * or its answer could not be recorded): no session reached the shopper, so
 * another gateway may safely be asked. A payment that opened and then failed
 * at the shopper's end is not retried here; the shopper retries.
 */
export const couldNotStart = (s: Started): boolean =>
  s.status === 'failed' && s.session == null && s.error !== null

/**
 * Start the first try; while a gateway could not open the payment, open a new
 * attempt for the next gateway (`reopen`, which returns null when the order
 * can no longer take one) and start that. Each try is its own attempt with its
 * own idempotency key and records its own gateway, so webhooks and refunds
 * stay with the gateway that actually took the money. Returns the last answer.
 */
export async function runWithFallbacks<P, S extends Started>(
  first: { attemptId: string } & FallbackTry<P>,
  chain: FallbackTry<P>[],
  steps: {
    start: (attemptId: string, provider: P, methods: OnlineMethodId[] | undefined) => Promise<S>
    reopen: (failedAttemptId: string, provider: P) => Promise<string | null>
  },
): Promise<S> {
  let started = await steps.start(first.attemptId, first.provider, first.methods)
  for (const next of chain) {
    if (!couldNotStart(started)) break
    const attemptId = await steps.reopen(started.attemptId, next.provider)
    if (!attemptId) break
    started = await steps.start(attemptId, next.provider, next.methods)
  }
  return started
}
