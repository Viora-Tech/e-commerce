/** SOURCE OF TRUTH: taxParcels
 * WHAT:  The GST of an order shipped as these parcels: each parcel's origin, share and tax
 *        (tax/parcel-gst.ts), the order's sum, and the GSTIN the order is billed from.
 * WHY:   Checkout and draft conversion both turn routed parcels into money and tax the same way,
 *        so an order converted from a draft is billed exactly like one placed at checkout.
 * WHERE: placeOrder's createOrder step and convertDraft.
 */
import type { OrderTaxOrigin, StoreTx } from '@commerce/db'
import type { GstLineInput, OrderGst } from '../tax/gst'
import { compositionRegistrations, taxOriginForParcels } from '../tax/origin'
import { computeParcelGst, mergeOrderGst } from '../tax/parcel-gst'
import type { ParcelMoney } from './fulfillment-orders'
import type { RoutedParcel } from './routing'

export type ParcelTax = {
  /** The parcel holding the most value: what the order is billed from. */
  origin: OrderTaxOrigin
  /** The parcels' summed GST; null for an order without parcels (gift cards only). */
  tax: OrderGst | null
  /** Each parcel's share and tax, as its fulfilment order stores it (same order as `parcels`). */
  money: ParcelMoney[]
}

export async function taxParcels(
  tx: StoreTx,
  input: {
    parcels: readonly RoutedParcel[]
    /** A parcel line's tax-inclusive value and GST rate, by its routing key and units. */
    lineOf: (key: string, quantity: number) => GstLineInput
    discountPaise: number
    adjustmentPaise: number
    shippingPaise: number
    shipToState: string | null
    storeState: string | null
  },
): Promise<ParcelTax> {
  const gross = (p: RoutedParcel) =>
    p.lines.reduce((sum, l) => sum + input.lineOf(l.key, l.quantity).grossPaise, 0)
  const origin = await taxOriginForParcels(tx, {
    parcels: input.parcels.map((p) => ({ locationId: p.locationId, grossPaise: gross(p) })),
    storeState: input.storeState,
  })
  const origins = await Promise.all(
    input.parcels.map((p) =>
      taxOriginForParcels(tx, {
        parcels: [{ locationId: p.locationId, grossPaise: gross(p) }],
        storeState: input.storeState,
      }),
    ),
  )
  const composition = await compositionRegistrations(
    tx,
    origins.map((o) => o.gstRegistrationId),
  )
  const shares = computeParcelGst({
    parcels: input.parcels.map((p, i) => ({
      key: String(i),
      lines: p.lines.map((l) => input.lineOf(l.key, l.quantity)),
      originState: origins[i]?.stateCode ?? null,
      composition: composition.has(origins[i]?.gstRegistrationId ?? ''),
    })),
    discountPaise: input.discountPaise,
    adjustmentPaise: input.adjustmentPaise,
    shippingPaise: input.shippingPaise,
    shipToState: input.shipToState,
  })
  return {
    origin,
    tax: shares.length > 0 ? mergeOrderGst(shares.map((g) => g.gst)) : null,
    money: shares.map((g, i) => {
      const at = origins[i] ?? origin
      return {
        subtotalPaise: g.subtotalPaise,
        discountPaise: g.discountPaise,
        adjustmentPaise: g.adjustmentPaise,
        shippingPaise: g.shippingPaise,
        totalPaise: g.totalPaise,
        taxPaise: g.gst.taxPaise,
        taxBreakdown: g.gst,
        taxOrigin: at,
        gstRegistrationId: at.gstRegistrationId,
      }
    }),
  }
}
