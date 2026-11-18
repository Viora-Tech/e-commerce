/** SOURCE OF TRUTH: cancelShipment, returnShipmentToBooked, rebookableParcels, ShipmentNotCancellable — WHAT: cancel a booked label before the courier collects it (keeping the parcel packed, or unpacking it), or take it off its pickup back to Booked, and record who did it / WHY: one place decides when a cancel is allowed and what booking again carries; the three choices of the cancel dialog (owner, 18 Nov 2026) */
import { orderNote, shipment, shipmentManifest } from '@commerce/db'
import type { ShippingProvider } from '@commerce/shipping'
import { eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { unpackFulfillmentOrder } from '../order/fulfillment-orders'
import { recomputeOrderStatuses } from '../order/recompute'
import { releaseSharedOrders } from './shared-parcel'
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
}

/**
 * Takes a shipment off its pickup and out of every manifest that lists it (our printed lists for
 * the pickup executive). The courier's pickup request stays: it simply finds one parcel fewer.
 */
async function leavePickup(tx: StoreContext['tx'], shipmentId: string): Promise<void> {
  await tx
    .update(shipmentManifest)
    .set({ shipmentIds: sql`array_remove(${shipmentManifest.shipmentIds}, ${shipmentId}::uuid)` })
    .where(sql`${shipmentId}::uuid = any(${shipmentManifest.shipmentIds})`)
}

/** A shipment that is not waiting on a pickup cannot go back to Booked. */
export class ShipmentNotOnPickup extends CommerceError {
  constructor(storeId?: string) {
    super('SHIPMENT_NOT_ON_PICKUP', 'This parcel is not on a pickup, so it is already in Booked.', {
      storeId,
    })
  }
}

/**
 * "Move back to Booked": the label stays live with the courier, the parcel leaves its pickup and
 * manifest, so it can go on another day's pickup. Only while it is still at the store.
 */
export async function returnShipmentToBooked(
  ctx: StoreContext,
  shipmentId: string,
  options: { author?: string | null | undefined } = {},
): Promise<ShipmentRow> {
  const [row] = await ctx.tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new Error('shipment not found')
  const block = cancelBlock(row, { courierCancels: true })
  if (block) throw new ShipmentNotCancellable(block, ctx.storeId)
  if (!row.pickupId) throw new ShipmentNotOnPickup(ctx.storeId)
  await leavePickup(ctx.tx, row.id)
  const [updated] = await ctx.tx
    .update(shipment)
    .set({ pickupId: null, updatedAt: new Date() })
    .where(eq(shipment.id, shipmentId))
    .returning()
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId: row.orderId,
    body: `Took AWB ${row.waybill} off its pickup. It is back in Booked, ready for another pickup.`,
    author: options.author ?? null,
  })
  return updated ?? row
}

export type CancelShipmentOptions = {
  /** Staff email for the order timeline entry. */
  author?: string | null | undefined
  /** False when the courier app does not declare `cancel`. */
  courierCancels?: boolean | undefined
  /**
   * True for "Cancel shipment": only the label goes, the items stay packed and the order waits in
   * To book for a new label. False (default) for "Cancel fulfilment": the items are unpacked too.
   */
  keepPacked?: boolean | undefined
}

/**
 * Cancel a booked label with its courier, before the parcel leaves (`cancelBlock`), also from a
 * pickup or manifest (it leaves both). Unless `keepPacked`, the parcel's units are unpacked (back
 * to To ship and back in stock, `unpackFulfillmentOrder`). The order timeline says who cancelled
 * which AWB.
 */
export async function cancelShipment(
  ctx: StoreContext,
  provider: ShippingProvider,
  shipmentId: string,
  options: CancelShipmentOptions = {},
): Promise<ShipmentRow> {
  const [row] = await ctx.tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new Error('shipment not found')
  const block = cancelBlock(row, { courierCancels: options.courierCancels ?? true })
  if (block) throw new ShipmentNotCancellable(block, ctx.storeId)
  // Most couriers cancel by waybill; RapidShyp's cancel_order wants its own
  // order id instead (stored as providerRef on create) - see
  // packages/shipping-rapidshyp/src/rapidshyp.ts. Shiprocket keeps its shipment id in
  // providerRef but cancels by AWB, so the row's own waybill goes along too.
  await provider.cancel(row.providerRef || row.waybill, {
    waybill: row.waybill,
    providerRef: row.providerRef,
  })
  await leavePickup(ctx.tx, row.id)
  const [updated] = await ctx.tx
    .update(shipment)
    .set({ status: 'cancelled', pickupId: null, updatedAt: new Date() })
    .where(eq(shipment.id, shipmentId))
    .returning()
  if (options.keepPacked) {
    await ctx.tx.insert(orderNote).values({
      storeId: ctx.storeId,
      orderId: row.orderId,
      body: `Cancelled the ${provider.label} shipment (AWB ${row.waybill}). Its items stay packed, ready to book again.`,
      author: options.author ?? null,
    })
    await recomputeOrderStatuses(ctx, row.orderId)
    return updated ?? row
  }
  // The items come out of the box: back to To ship and back in stock (owner, 10 Nov 2026). A
  // shipment from before parcels carried the whole order, unless another label is still live.
  const othersLive =
    row.fulfillmentOrderId === null &&
    (
      await ctx.tx
        .select({ status: shipment.status })
        .from(shipment)
        .where(eq(shipment.orderId, row.orderId))
    ).some((s) => s.status !== 'cancelled' && s.status !== 'rto')
  if (!othersLive) await unpackFulfillmentOrder(ctx, row.orderId, row.fulfillmentOrderId)
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId: row.orderId,
    body: `Cancelled the ${provider.label} shipment (AWB ${row.waybill}). Its items are back to To ship.`,
    author: options.author ?? null,
  })
  await recomputeOrderStatuses(ctx, row.orderId)
  // Orders packed in the same box ("Same box as #A") come out of it too.
  await releaseSharedOrders(ctx, [row.id], options.author ?? null)
  return updated ?? row
}
