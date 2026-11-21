/** SOURCE OF TRUTH: Razorpay refunds — WHAT: one refund per refund key; a retry finds the refund already made (by receipt or notes) instead of refunding again / WHY: refundPayment asks the gateway inside its transaction, so a failed commit's retry used to refund twice (Cashfree does this with refund_id, #1595) */
import type Razorpay from 'razorpay'

/** Razorpay caps `receipt` at 40 characters, note values at 256. */
const RECEIPT_MAX_LEN = 40
const NOTE_MAX_LEN = 256
/** The most refunds one list call returns; a payment never has this many. */
const LIST_MAX = 100

type RzpRefund = {
  id: string
  amount: number
  status: string
  receipt?: string | null
  notes?: Record<string, string> | unknown[] | null
}

export type RefundResult = { providerRefundId: string; status: 'pending' | 'processed' }

const resultOf = (r: RzpRefund): RefundResult => ({
  providerRefundId: r.id,
  status: r.status === 'processed' ? 'processed' : 'pending',
})

function keyOf(r: RzpRefund): string | undefined {
  const notes = r.notes && !Array.isArray(r.notes) ? r.notes : undefined
  return notes?.refund_key ?? r.receipt ?? undefined
}

/** The refund made earlier with this key, if any. Failed refunds do not count. */
async function findByKey(
  client: Razorpay,
  paymentId: string,
  key: string,
): Promise<RzpRefund | undefined> {
  const res = (await client.payments.fetchMultipleRefund(paymentId, { count: LIST_MAX })) as {
    items?: RzpRefund[]
  }
  return res.items?.find((r) => r.status !== 'failed' && keyOf(r) === key)
}

/** A refund found by key must be for this amount: the key is reused only by a retry. */
function sameAmount(r: RzpRefund, amountPaise: number): RzpRefund {
  if (Number(r.amount) !== amountPaise) {
    throw new Error(
      `Razorpay already has refund ${r.id} with this refund key for another amount (${r.amount} paise)`,
    )
  }
  return r
}

/**
 * Refund `amountPaise` of a payment. With a `refundKey`, Razorpay's refunds of the payment are
 * looked up first (the key travels as the receipt and as `notes.refund_key`), and again when
 * the create call fails, since its reply may be what was lost. Razorpay has no idempotency key
 * for refunds, so this lookup is the dedupe.
 */
export async function refundOnce(
  client: Razorpay,
  paymentId: string,
  amountPaise: number,
  note: string | undefined,
  refundKey: string | undefined,
): Promise<RefundResult> {
  const notes: Record<string, string> = {}
  if (note) notes.note = note.slice(0, NOTE_MAX_LEN)
  if (!refundKey) {
    const r = (await client.payments.refund(paymentId, {
      amount: amountPaise,
      notes: note ? notes : undefined,
    })) as unknown as RzpRefund
    return resultOf(r)
  }

  const key = refundKey.slice(0, RECEIPT_MAX_LEN)
  const earlier = await findByKey(client, paymentId, key)
  if (earlier) return resultOf(sameAmount(earlier, amountPaise))
  notes.refund_key = key
  try {
    const r = (await client.payments.refund(paymentId, {
      amount: amountPaise,
      receipt: key,
      notes,
    })) as unknown as RzpRefund
    return resultOf(r)
  } catch (err) {
    const made = await findByKey(client, paymentId, key).catch(() => undefined)
    if (!made) throw err
    return resultOf(sameAmount(made, amountPaise))
  }
}
