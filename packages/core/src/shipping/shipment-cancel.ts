/** SOURCE OF TRUTH: cancelShipment, rebookableParcels, ShipmentNotCancellable — WHAT: cancel a booked label before pickup or manifest, record who did it, and free the packed parcel to book again / WHY: one place decides when a cancel is allowed and what booking again carries */
import { orderNote, shipment, shipmentManifest } from '@commerce/db'
import type { ShippingProvider } from '@commerce/shipping'
import { eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { recomputeOrderStatuses } from '../order/recompute'
import { type CancelBlock, cancelBlock } from './shipment-state'
import type { ShipmentRow } from './shipments'

/**
 * The parcels of an order whose label was cancelled and not booked again (null: a shipment from
 * before parcels, which carried the whole order). Their units stay packed after the cancel (they
 * are in the box), so these are what "Book again" offers.
 */
export async function rebookableParcels(
  tx: StoreContext['tx'],
  orderId: string,
): Promise<Set<string | null>> {
  const rows = await tx
    .select({ status: shipment.status, fulfillmentOrderId: shipment.fulfillmentOrderId })
    .from(shipment)
    .where(eq(shipment.orderId, orderId))
  const live = new Set(
    rows
      .filter((r) => r.status !== 'cancelled' && r.status !== 'rto')
      .map((r) => r.fulfillmentOrderId),
  )
  return new Set(
    rows
      .filter((r) => r.status === 'cancelled' && !live.has(r.fulfillmentOrderId))
      .map((r) => r.fulfillmentOrderId),
  )
}

/** A cancel the platform refuses before asking the courier; `block` says why (`CancelBlock`). */
export class ShipmentNotCancellable extends CommerceError {
  readonly block: CancelBlock
  constructor(block: CancelBlock, storeId?: string) {
    super('SHIPMENT_NOT_CANCELLABLE', CANCEL_BLOCK_MESSAGE[block], { storeId })
    this.block = block
  }
}

const CANCEL_BLOCK_MESSAGE: Record<CancelBlock, string> = {
  not_supported:
    'This courier does not take cancellations here. Cancel it on the courier’s own site.',
  cancelled: 'This shipment is already cancelled.',
  picked_up: 'The courier has already collected this parcel, so it can no longer be cancelled.',
  settled: 'This parcel was delivered or returned, so there is nothing to cancel.',
  in_manifest:
    'This parcel is on a manifest handed to the courier, so it can no longer be cancelled.',
}

/** Whether a shipment id is on one of the store's manifests (handed to the courier). */
export async function shipmentInManifest(
  tx: StoreContext['tx'],
  shipmentId: string,
): Promise<boolean> {
  const [hit] = await tx
    .select({ id: shipmentManifest.id })
    .from(shipmentManifest)
    .where(sql`${shipmentId}::uuid = any(${shipmentManifest.shipmentIds})`)
    .limit(1)
  return Boolean(hit)
}

export type CancelShipmentOptions = {
  /** Staff email for the order timeline entry. */
  author?: string | null | undefined
  /** False when the courier app does not declare `cancel` (Shiprocket today). */
  courierCancels?: boolean | undefined
}

/**
 * Cancel a booked label with its courier, before the parcel leaves (`cancelBlock`). The packed
 * units stay packed (they are in the box), the order drops back to packed, the parcel can be
 * booked again (`rebookableParcels`), and the order timeline says who cancelled which AWB.
 */
export async function cancelShipment(
  ctx: StoreContext,
  provider: ShippingProvider,
  shipmentId: string,
  options: CancelShipmentOptions = {},
): Promise<ShipmentRow> {
  const [row] = await ctx.tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new Error('shipment not found')
  const block = cancelBlock(row, {
    inManifest: await shipmentInManifest(ctx.tx, row.id),
    courierCancels: options.courierCancels ?? true,
  })
  if (block) throw new ShipmentNotCancellable(block, ctx.storeId)
  // Most couriers cancel by waybill; RapidShyp's cancel_order wants its own
  // order id instead (stored as providerRef on create) - see
  // packages/shipping-rapidshyp/src/rapidshyp.ts.
  await provider.cancel(row.providerRef || row.waybill)
  const [updated] = await ctx.tx
    .update(shipment)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(shipment.id, shipmentId))
    .returning()
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId: row.orderId,
    body: `Cancelled the ${provider.label} shipment (AWB ${row.waybill}). The parcel can be booked again.`,
    author: options.author ?? null,
  })
  await recomputeOrderStatuses(ctx, row.orderId)
  return updated ?? row
}
