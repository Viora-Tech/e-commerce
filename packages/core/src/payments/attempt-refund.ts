/** SOURCE OF TRUTH: compensating refund — WHAT: refunds money a capture-at-creation gateway took for an attempt whose answer could not be recorded, with a stable key, never throwing / WHY: a throwing refund skipped markFailed and left the attempt unclaimable (#1791) */
import { type PaymentProvider, readableError } from '@commerce/payments'

/**
 * Give back money a capture-at-creation gateway took for an attempt we could not record. The
 * refund key is stable per attempt, so a gateway that dedupes on it (Razorpay, Cashfree) never
 * refunds twice. A refund that throws is logged for staff and returned as words for the
 * attempt's error, so the money owed stays visible; it never stops the attempt being failed.
 */
export async function refundTaken(
  provider: PaymentProvider,
  attemptId: string,
  providerRef: string,
  attempt: { amountPaise: number },
  log: Pick<Console, 'error'>,
): Promise<string | null> {
  try {
    await provider.refund(providerRef, attempt.amountPaise, undefined, {
      providerRef,
      refundKey: `rfc_${attemptId.replace(/-/g, '').slice(0, 20)}`,
    })
    return null
  } catch (refundErr) {
    log.error('[payments] compensating refund failed; refund by hand', {
      attemptId,
      providerRef,
      amountPaise: attempt.amountPaise,
      error: readableError(refundErr),
    })
    return `The gateway took the payment (${providerRef}) and refunding it failed (${readableError(refundErr)}): refund it by hand`
  }
}
