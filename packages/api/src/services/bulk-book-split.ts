import { type ParcelSplitReason, splitFulfillmentOrder } from '@commerce/core'
import type { StoreTx } from '@commerce/db'

/**
 * Bulk Create shipment's partial parcels: the bulk drawer's Edit popup picked which items of an
 * order's parcel ship now. Like the order page's partial shipment (`shipments.splitParcel`, run
 * as its booking starts), the parcel keeps those units and the rest moves to a new parcel that
 * stays in To ship; the booking then sends only the kept units.
 */
export type BulkSplit = {
  /** Every line of the quoted parcel with how many go now. */
  keep?: Array<{ orderLineId: string; quantity: number }> | undefined
  splitReason?: ParcelSplitReason | undefined
  notifyCustomer?: boolean | undefined
}

/** Splits the order's quoted parcel before it books. Returns why it could not, else null
 *  (also when nothing was asked). */
export async function splitBeforeBooking(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  parcelId: string | undefined,
  own: BulkSplit | undefined,
  author: string | undefined,
): Promise<string | null> {
  if (!own?.keep) return null
  if (!parcelId) return 'Pick the parcel to ship part of.'
  try {
    await splitFulfillmentOrder({ tx, storeId }, orderId, parcelId, own.keep, {
      reason: own.splitReason ?? 'not_ready',
      notifyCustomer: own.notifyCustomer ?? false,
      author,
    })
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}
