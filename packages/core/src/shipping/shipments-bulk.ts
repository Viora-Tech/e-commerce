/** SOURCE OF TRUTH: bulk shipments — WHAT: bulkCreateShipments, one shipment per selected order with a result each / WHY: the orders list's bulk "Create shipments"; split out of shipments.ts */
import type { ShippingProvider } from '@commerce/shipping'
import type { StoreContext } from '../context'

import { type CreateShipmentOptions, createShipmentForOrder } from './shipments'

export type BulkCreateResult = {
  orderId: string
  ok: boolean
  shipmentId?: string
  waybill?: string
  labelUrl?: string | null
  error?: string
}

/**
 * Book several orders with one courier in one go (the Shipments workspace's
 * bulk action). Each order is its own best-effort attempt: one courier
 * rejection (a bad pincode, a duplicate) never stops the rest from booking.
 */
export async function bulkCreateShipments(
  ctx: StoreContext,
  provider: ShippingProvider,
  orderIds: string[],
  options: CreateShipmentOptions = {},
): Promise<BulkCreateResult[]> {
  const results: BulkCreateResult[] = []
  for (const orderId of orderIds) {
    try {
      const row = await createShipmentForOrder(ctx, provider, orderId, options)
      results.push({
        orderId,
        ok: true,
        shipmentId: row.id,
        waybill: row.waybill,
        labelUrl: row.labelUrl,
      })
    } catch (err) {
      results.push({ orderId, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return results
}
