/** SOURCE OF TRUTH: recomputeCommissionForEdit — WHAT: the commission after staff edit an order's items, shipping or discount / WHY: a pending commission follows the edited order; earned money is never rewritten, only clawed back */
import { order, type StoreTx } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { computeCommission, scaleForRefund, tierFor } from './commission'
import {
  approvedSales,
  type CommissionRow,
  commissionForOrder,
  commissionLines,
  goodsPaidPaise,
  refundedForCommission,
} from './commissions'
import { getProgram, programOf } from './programs'
import { affiliate, affiliateCommission } from './schema'
import { withProgramRules } from './settings'
import { loadAffiliateSettings } from './store-settings'

/**
 * `order.edited`: work the commission out again from the edited lines and totals, with the
 * program it was credited under, then take off what was refunded since (not the edit's own
 * refunds, `refundedForCommission`).
 * - Pending and in no payout: rewritten in place, up or down (base, earned, commission).
 * - Approved, paid or in a payout: only ever lowered. Not in a payout yet, the TDS follows the
 *   smaller credit; in a payout, the difference becomes a clawback the next payout recovers.
 * A reversed commission, a cancelled order, or an order with no commission is left alone.
 */
export async function recomputeCommissionForEdit(
  tx: StoreTx,
  storeId: string,
  orderId: string,
): Promise<CommissionRow | null> {
  const current = await commissionForOrder(tx, orderId)
  if (!current || current.status === 'reversed') return null
  const [o] = await tx.select().from(order).where(eq(order.id, orderId))
  if (!o || o.status === 'cancelled') return null
  const [a] = await tx.select().from(affiliate).where(eq(affiliate.id, current.affiliateId))
  if (!a) return null
  const program =
    (current.programId ? await getProgram(tx, current.programId) : null) ??
    (await programOf(tx, storeId, a))
  const rules = withProgramRules(await loadAffiliateSettings(tx, storeId), program.rules)
  const result = computeCommission(
    {
      subtotalPaise: o.subtotalPaise,
      discountPaise: o.discountPaise + Math.max(0, -o.paymentAdjustmentPaise),
      lines: await commissionLines(tx, orderId),
    },
    rules,
    tierFor(rules.tiers, await approvedSales(tx, a.id)),
    a.rateOverride ?? null,
  )
  const next = scaleForRefund(
    result.commissionPaise,
    goodsPaidPaise(o),
    await refundedForCommission(tx, orderId),
  )
  const now = new Date()
  if (current.status === 'pending' && !current.payoutId) {
    const [row] = await tx
      .update(affiliateCommission)
      .set({
        basePaise: result.basePaise,
        earnedPaise: result.commissionPaise,
        commissionPaise: next,
        updatedAt: now,
      })
      .where(eq(affiliateCommission.id, current.id))
      .returning()
    return row ?? null
  }
  if (next >= current.commissionPaise) return current
  const lower = current.commissionPaise - next
  const [row] = await tx
    .update(affiliateCommission)
    .set({
      commissionPaise: next,
      ...(current.payoutId
        ? { clawbackPaise: current.clawbackPaise + lower }
        : {
            tdsPaise:
              current.commissionPaise > 0
                ? Math.round((current.tdsPaise * next) / current.commissionPaise)
                : current.tdsPaise,
          }),
      updatedAt: now,
    })
    .where(eq(affiliateCommission.id, current.id))
    .returning()
  return row ?? null
}
