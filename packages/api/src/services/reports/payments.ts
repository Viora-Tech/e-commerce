import { paymentMethodKey, readManualCollection } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { order, payment } from '@commerce/db'
import { and, eq, not, sql } from 'drizzle-orm'
import { bucketByDay } from '../analytics-buckets'
import {
  byDesc,
  groupBy,
  notDraft,
  type ReportBuilder,
  type ReportSpan,
  sumOf,
  withShare,
} from './types'

/** Providers the merchant settles by hand: cash on delivery and their own UPI or bank account. */
const OFFLINE_PROVIDERS = new Set(['cod', 'manual'])

/**
 * When the money arrived: the day the merchant recorded for a manual collection
 * (midnight IST), else when the payment row was written.
 */
const receivedAt = sql<Date>`coalesce(
  ((${payment.checkoutSession} -> 'collected' ->> 'receivedOn') || 'T00:00:00+05:30')::timestamptz,
  ${payment.createdAt})`

type PaymentFact = {
  method: string
  byHand: boolean
  amountPaise: number
  at: Date
}

/** Captured payments received in the span that the store keeps (money owed back is left out). */
async function paymentFacts(tx: StoreTx, span: ReportSpan): Promise<PaymentFact[]> {
  const rows = await tx
    .select({
      provider: payment.provider,
      checkoutSession: payment.checkoutSession,
      amountPaise: payment.amountPaise,
      at: receivedAt,
    })
    .from(payment)
    .innerJoin(order, eq(order.id, payment.orderId))
    .where(
      and(
        notDraft,
        eq(payment.status, 'captured'),
        not(payment.refundNeeded),
        sql`${receivedAt} >= ${span.from.toISOString()}::timestamptz`,
        sql`${receivedAt} < ${span.to.toISOString()}::timestamptz`,
      ),
    )
  return rows.map((r) => ({
    method: paymentMethodKey(r),
    byHand: readManualCollection(r.checkoutSession) !== null || OFFLINE_PROVIDERS.has(r.provider),
    amountPaise: r.amountPaise,
    at: new Date(r.at),
  }))
}

export const paymentBuilders: Record<string, ReportBuilder> = {
  /**
   * Money received, grouped by how it came in: the method the merchant picked
   * when marking an order paid (UPI, bank transfer, cash, cheque, other), or
   * the gateway that captured it.
   */
  'payments-by-method': async (tx, span) => {
    const facts = await paymentFacts(tx, span)
    const total = sumOf(facts, (f) => f.amountPaise)
    const rows = [...groupBy(facts, (f) => f.method)].map(([method, group]) => ({
      key: method,
      values: {
        method,
        recorded: group.every((f) => f.byHand) ? 'by_hand' : 'automatic',
        payments: group.length,
        amount: sumOf(group, (f) => f.amountPaise),
      },
    }))
    const daily = bucketByDay(
      facts.map((f) => ({ at: f.at, weight: f.amountPaise })),
      span.days,
    )
    return {
      rows: withShare(rows, 'amount', total).sort(byDesc('amount')),
      totals: { payments: facts.length, amount: total },
      series: span.days.map((d, i) => ({ label: d, value: daily[i] ?? 0 })),
    }
  },
}
