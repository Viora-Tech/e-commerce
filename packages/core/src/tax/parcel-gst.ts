/** SOURCE OF TRUTH: computeParcelGst, mergeOrderGst, PARCEL_ALLOCATION
 * WHAT:  GST for an order shipped in several parcels, each billed under its own GSTIN.
 * WHY:   GST is charged by the registration the goods leave from, so each parcel splits its
 *        tax as CGST + SGST (same state as the buyer) or IGST on its own. Prices include GST:
 *        the shopper's total never changes, only how the tax inside it is split.
 *        PARCEL_ALLOCATION: the order-level discount, the payment-method fee or discount and
 *        shipping are shared out over the parcels by goods value (largest remainder, whole
 *        paise), so the parcels' totals add back to the order total exactly. Each parcel's tax
 *        is then `computeOrderGst` on its own share. A parcel billed under a composition GSTIN
 *        charges no GST (a bill of supply). With one parcel this is exactly the order-level
 *        computation it replaces.
 * WHERE: placeOrder's createOrder step stores each parcel's share and tax on its fulfilment
 *        order and the merged result on the order; invoices per parcel read the parcel's.
 */
import {
  allocatePaise,
  computeOrderGst,
  type GstLineInput,
  type GstRateRow,
  type OrderGst,
} from './gst'

export type ParcelGstInput = {
  /** The caller's key for the parcel, echoed back. */
  key: string
  /** The parcel's goods: tax-inclusive quantity × unit price and the line's rate. */
  lines: readonly GstLineInput[]
  /** The state of the GSTIN (or store address) the parcel is billed from. */
  originState: string | null
  /** Billed under a composition-scheme GSTIN: no GST is charged on it. */
  composition: boolean
}

/** One parcel's share of the order's money, and the GST inside its total. */
export type ParcelGst = {
  key: string
  subtotalPaise: number
  discountPaise: number
  /** Fee (+) or discount (−) for the payment method. */
  adjustmentPaise: number
  shippingPaise: number
  /** subtotal − discount + adjustment + shipping. */
  totalPaise: number
  gst: OrderGst
}

/** Share a signed amount over weights, whole paise, adding back exactly. */
function share(total: number, weights: readonly number[]): number[] {
  const parts = allocatePaise(Math.abs(total), weights)
  return total < 0 ? parts.map((p) => -p) : parts
}

/** PARCEL_ALLOCATION as a pure function: see the header. */
export function computeParcelGst(input: {
  parcels: readonly ParcelGstInput[]
  discountPaise: number
  adjustmentPaise: number
  shippingPaise: number
  shipToState: string | null | undefined
}): ParcelGst[] {
  const goods = input.parcels.map((p) =>
    p.lines.reduce((sum, l) => sum + Math.max(0, l.grossPaise), 0),
  )
  const discounts = share(input.discountPaise, goods)
  const adjustments = share(input.adjustmentPaise, goods)
  const shipping = share(input.shippingPaise, goods)
  return input.parcels.map((p, i) => {
    const subtotalPaise = goods[i] ?? 0
    const discountPaise = discounts[i] ?? 0
    const adjustmentPaise = adjustments[i] ?? 0
    const shippingPaise = shipping[i] ?? 0
    const totalPaise = subtotalPaise - discountPaise + adjustmentPaise + shippingPaise
    const lines = p.composition ? p.lines.map((l) => ({ ...l, ratePercent: 0 })) : p.lines
    return {
      key: p.key,
      subtotalPaise,
      discountPaise,
      adjustmentPaise,
      shippingPaise,
      totalPaise,
      gst: computeOrderGst({
        lines,
        totalPaise,
        reductionPaise: discountPaise + Math.max(0, -adjustmentPaise),
        shipToState: input.shipToState,
        storeState: p.originState,
      }),
    }
  })
}

/**
 * The order's GST as the sum of its parcels'. Rates merge row by row; the headline rate is the
 * one with the largest value (ties to the higher rate). `interState` is true
 * only when every parcel is IGST: a mixed order shows both CGST + SGST and IGST.
 */
export function mergeOrderGst(parts: readonly OrderGst[]): OrderGst {
  // One parcel is the order: exactly what the order-level computation gave.
  if (parts.length === 1 && parts[0]) return parts[0]
  const byRate = new Map<number, GstRateRow>()
  for (const part of parts) {
    for (const row of part.byRate) {
      const into = byRate.get(row.ratePercent)
      if (!into) {
        byRate.set(row.ratePercent, { ...row })
        continue
      }
      into.amountPaise += row.amountPaise
      into.taxablePaise += row.taxablePaise
      into.taxPaise += row.taxPaise
      into.cgstPaise += row.cgstPaise
      into.sgstPaise += row.sgstPaise
      into.igstPaise += row.igstPaise
    }
  }
  const rows = [...byRate.values()].sort((a, b) => a.ratePercent - b.ratePercent)
  const sum = (pick: (g: OrderGst) => number) => parts.reduce((a, g) => a + pick(g), 0)
  const principal = rows.reduce<GstRateRow | null>(
    (best, r) => (!best || r.amountPaise >= best.amountPaise ? r : best),
    null,
  )
  return {
    taxPaise: sum((g) => g.taxPaise),
    cgstPaise: sum((g) => g.cgstPaise),
    sgstPaise: sum((g) => g.sgstPaise),
    igstPaise: sum((g) => g.igstPaise),
    ratePercent: principal?.ratePercent ?? parts[0]?.ratePercent ?? 0,
    interState: parts.length > 0 && parts.every((g) => g.interState),
    byRate: rows,
  }
}
