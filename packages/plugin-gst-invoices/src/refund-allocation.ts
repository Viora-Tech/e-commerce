/** SOURCE OF TRUTH: allocateRefund, refundWeights, REFUND_ALLOCATION
 * WHAT:  How a refund on an order billed in parcels splits into one credit note per GSTIN.
 * WHY:   Each parcel's invoice is a supply by its own GSTIN, so money given back is a reduction
 *        of whichever supplies it was for. REFUND_ALLOCATION:
 *        1. A refund for a return: by the value of the returned units each parcel sent.
 *        2. Any other refund (a goodwill amount, shipping, a cancellation): pro rata to what each
 *           invoice can still be credited.
 *        No credit note ever exceeds what its invoice can still be credited (its total less the
 *        credit notes already issued against it); what one cannot take passes to the others.
 *        Whole paise, largest remainder, adding back exactly.
 * WHERE: issue.ts `issueCreditNotes`.
 */
import { allocatePaise } from '@commerce/core/gst'
import {
  fulfillmentOrder,
  fulfillmentOrderLine,
  orderLine,
  returnRequest,
  returnRequestLine,
  type StoreTx,
} from '@commerce/db'
import { and, asc, desc, eq, sql } from 'drizzle-orm'

export type CreditTarget = {
  key: string
  /** What the invoice can still be credited. */
  capacityPaise: number
  /** The share it should take (returned value); all zero means pro rata to capacity. */
  weight: number
}

/** REFUND_ALLOCATION as a pure function: see the header. */
export function allocateRefund(
  amountPaise: number,
  targets: readonly CreditTarget[],
): Map<string, number> {
  const given = new Map(targets.map((t) => [t.key, 0]))
  const room = (t: CreditTarget) => t.capacityPaise - (given.get(t.key) ?? 0)
  const capacity = targets.reduce((n, t) => n + Math.max(0, t.capacityPaise), 0)
  let left = Math.min(Math.max(0, Math.round(amountPaise)), capacity)
  let pool = targets.filter((t) => room(t) > 0)
  while (left > 0 && pool.length > 0) {
    const weighted = pool.some((t) => t.weight > 0)
    const parts = allocatePaise(
      left,
      pool.map((t) => (weighted ? Math.max(0, t.weight) : room(t))),
    )
    pool.forEach((t, i) => {
      const give = Math.min(parts[i] ?? 0, room(t))
      given.set(t.key, (given.get(t.key) ?? 0) + give)
      left -= give
    })
    pool = pool.filter((t) => room(t) > 0)
  }
  return given
}

/** Units of one order line a return sent back, at the price it was sold for. */
export type ReturnedLine = { orderLineId: string; quantity: number; unitPricePaise: number }

/**
 * The units a refund was made for: the return that lists the refund in `refund_ids`, all of
 * them and split over the parcels that sent them (a returned line's units are taken from the
 * parcels that packed it, first parcel first). Empty for any other refund.
 */
export async function refundReturnedUnits(
  tx: StoreTx,
  orderId: string,
  refundId: string,
): Promise<{ all: ReturnedLine[]; byParcel: Map<string, ReturnedLine[]> }> {
  const all = await tx
    .select({
      orderLineId: returnRequestLine.orderLineId,
      quantity: returnRequestLine.quantity,
      unitPricePaise: orderLine.unitPricePaise,
    })
    .from(returnRequestLine)
    .innerJoin(returnRequest, eq(returnRequest.id, returnRequestLine.returnRequestId))
    .innerJoin(orderLine, eq(orderLine.id, returnRequestLine.orderLineId))
    .where(
      and(
        eq(returnRequest.orderId, orderId),
        sql`${refundId}::uuid = any(${returnRequest.refundIds})`,
      ),
    )
  const byParcel = new Map<string, ReturnedLine[]>()
  if (all.length === 0) return { all, byParcel }
  const held = await tx
    .select({
      fulfillmentOrderId: fulfillmentOrderLine.fulfillmentOrderId,
      orderLineId: fulfillmentOrderLine.orderLineId,
      packed: fulfillmentOrderLine.fulfilledQuantity,
    })
    .from(fulfillmentOrderLine)
    .innerJoin(fulfillmentOrder, eq(fulfillmentOrder.id, fulfillmentOrderLine.fulfillmentOrderId))
    .where(eq(fulfillmentOrder.orderId, orderId))
    .orderBy(asc(fulfillmentOrder.position), desc(fulfillmentOrderLine.fulfilledQuantity))
  for (const r of all) {
    let units = r.quantity
    for (const h of held) {
      if (units <= 0) break
      if (h.orderLineId !== r.orderLineId || h.packed <= 0) continue
      const n = Math.min(units, h.packed)
      const lines = byParcel.get(h.fulfillmentOrderId) ?? []
      lines.push({ ...r, quantity: n })
      byParcel.set(h.fulfillmentOrderId, lines)
      units -= n
    }
  }
  return { all, byParcel }
}

/**
 * The value of returned units each parcel sent, for a refund made for a return
 * (`refundReturnedUnits`). Empty for any other refund.
 */
export async function refundWeights(
  tx: StoreTx,
  orderId: string,
  refundId: string,
): Promise<Map<string, number>> {
  const { byParcel } = await refundReturnedUnits(tx, orderId, refundId)
  const weights = new Map<string, number>()
  for (const [parcel, lines] of byParcel) {
    weights.set(
      parcel,
      lines.reduce((n, l) => n + l.quantity * l.unitPricePaise, 0),
    )
  }
  return weights
}
