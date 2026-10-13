/** SOURCE OF TRUTH: recordPaymentCharges, syncPaymentFees, merchantFee
 * WHAT:  Writes what a gateway kept from a payment (`payment.fee_paise`, `fee_tax_paise`) and how
 *        the shopper paid (`payment.method_detail`), from the capture webhook, a later charges
 *        webhook, or the fee sync asking the gateway.
 * WHY:   Gateways charge different rates by way of paying (UPI, RuPay debit, credit, corporate,
 *        international…), so a flat rate per gateway gets profit wrong. The gateway's own fee is
 *        the truth; until it arrives, the method picks the store's rate (order/profit.ts).
 * WHERE: payments/webhook.ts on capture and `payment.charges`; the worker's fee sync and its
 *        90-day backfill command (apps/worker/src/payment-fees.ts).
 */

import { type Db, payment, type StoreTx, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import type { PaymentCharges, PaymentProvider } from '@commerce/payments'
import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm'
import { PaymentMethodDetailSchema } from '../order/profit'

const DAY_MS = 86_400_000

/**
 * The part of a reported fee the merchant bore. When the shopper paid more than the attempt
 * asked (the gateway added its fee on top), that extra paid that much of the fee; the GST
 * inside shrinks in proportion. Null when the gateway reported no fee.
 */
export function merchantFee(
  charges: Pick<PaymentCharges, 'feePaise' | 'feeTaxPaise' | 'grossPaise'>,
  attemptPaise: number,
): { feePaise: number; feeTaxPaise: number | null } | null {
  if (charges.feePaise === null || !Number.isFinite(charges.feePaise)) return null
  const fee = Math.max(0, Math.round(charges.feePaise))
  const surplus = charges.grossPaise ? Math.max(0, charges.grossPaise - attemptPaise) : 0
  const borne = Math.max(0, fee - surplus)
  if (charges.feeTaxPaise === null || !Number.isFinite(charges.feeTaxPaise)) {
    return { feePaise: borne, feeTaxPaise: null }
  }
  const tax = Math.min(fee, Math.max(0, Math.round(charges.feeTaxPaise)))
  return { feePaise: borne, feeTaxPaise: fee > 0 ? Math.round((tax * borne) / fee) : 0 }
}

/**
 * Record what the gateway reported for one payment. A reported fee replaces what was there
 * (the gateway's latest word); no fee leaves it alone. A method replaces the stored one; none
 * keeps it. `checkedAt` (the fee sync asked the gateway) stamps `fee_checked_at`, so the sync
 * waits before asking again; a webhook leaves it, so a capture without a fee is asked soon.
 * Runs in the caller's transaction, under RLS.
 */
export async function recordPaymentCharges(
  tx: StoreTx,
  paymentId: string,
  charges: PaymentCharges,
  checkedAt?: Date,
): Promise<void> {
  const [p] = await tx
    .select({ amountPaise: payment.amountPaise })
    .from(payment)
    .where(eq(payment.id, paymentId))
  if (!p) return
  const fee = merchantFee(charges, p.amountPaise)
  const method = charges.method ? PaymentMethodDetailSchema.safeParse(charges.method) : null
  const changes = {
    ...(fee ? { feePaise: fee.feePaise, feeTaxPaise: fee.feeTaxPaise } : {}),
    ...(method?.success ? { methodDetail: method.data } : {}),
    ...(checkedAt ? { feeCheckedAt: checkedAt } : {}),
  }
  if (Object.keys(changes).length === 0) return
  await tx.update(payment).set(changes).where(eq(payment.id, paymentId))
}

export type FeeSyncOptions = {
  /** How far back to look. The backfill and the regular sync both use 90 days. */
  days?: number
  /** Most payments asked about in one run, per store. */
  limit?: number
  /** A payment asked about less than this long ago waits. */
  recheckAfterMs?: number
  /** Pause between gateway calls, to stay well under the gateway's rate limits. */
  pauseMs?: number
  now?: Date
  sleep?: (ms: number) => Promise<void>
}

export type FeeSyncResult = {
  /** Payments the gateway was asked about. */
  checked: number
  /** Of those, how many now have the gateway's fee. */
  recorded: number
  /** The gateway answered without a fee yet (Cashfree before settlement). */
  pending: number
  /** The gateway call failed; the payment is asked about again after the wait. */
  failed: number
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Ask the gateways for the fee on captured payments that do not have one yet: newest first,
 * one at a time with a pause, each written in its own short transaction (no gateway call is
 * made inside a transaction). Idempotent: a payment with a fee is never asked about again, and
 * one asked about recently waits `recheckAfterMs`.
 */
export async function syncPaymentFees(
  db: Db,
  storeId: string,
  providers: readonly PaymentProvider[],
  opts: FeeSyncOptions = {},
): Promise<FeeSyncResult> {
  const now = opts.now ?? new Date()
  const sleep = opts.sleep ?? wait
  const byId = new Map(providers.filter((p) => p.fetchCharges).map((p) => [p.id, p]))
  const result: FeeSyncResult = { checked: 0, recorded: 0, pending: 0, failed: 0 }
  if (byId.size === 0) return result
  const since = new Date(now.getTime() - (opts.days ?? 90) * DAY_MS)
  const recheckBefore = new Date(now.getTime() - (opts.recheckAfterMs ?? 6 * 3_600_000))

  const rows = await withStore(db, storeId, (tx) =>
    tx
      .select({
        id: payment.id,
        provider: payment.provider,
        providerRef: payment.providerRef,
        providerPaymentId: payment.providerPaymentId,
      })
      .from(payment)
      .where(
        and(
          isNull(payment.feePaise),
          isNotNull(payment.providerPaymentId),
          inArray(payment.status, ['captured', 'refunded']),
          inArray(payment.provider, [...byId.keys()]),
          gt(payment.createdAt, since),
          or(isNull(payment.feeCheckedAt), lt(payment.feeCheckedAt, recheckBefore)),
        ),
      )
      .orderBy(desc(payment.createdAt))
      .limit(opts.limit ?? 100),
  )

  for (const [i, row] of rows.entries()) {
    const provider = byId.get(row.provider)
    if (!provider?.fetchCharges || !row.providerPaymentId) continue
    if (i > 0) await sleep(opts.pauseMs ?? 250)
    result.checked += 1
    let charges: PaymentCharges | null = null
    try {
      charges = await provider.fetchCharges({
        providerRef: row.providerRef,
        providerPaymentId: row.providerPaymentId,
      })
    } catch (err) {
      result.failed += 1
      logger.warn('payment fee lookup failed', {
        storeId,
        paymentId: row.id,
        provider: row.provider,
        error: err,
      })
    }
    await withStore(db, storeId, (tx) =>
      recordPaymentCharges(
        tx,
        row.id,
        charges ?? { feePaise: null, feeTaxPaise: null, method: null },
        now,
      ),
    )
    if (charges?.feePaise != null) result.recorded += 1
    else if (charges) result.pending += 1
  }
  return result
}
