/** SOURCE OF TRUTH: cancelShipment, returnShipmentToBooked (refused for a courier that schedules its own pickup at booking: PickupScheduledByCourier), returnShipmentToSender, markShipmentCancelled, rebookableParcels, ShipmentNotCancellable — WHAT: every way out of a booked shipment: cancel the label before pickup (items stay packed or are unpacked), take it off its pickup back to Booked, cancel after pickup so the courier brings it back (RTO), or record a cancel already made on the courier's own app; each names who did it / WHY: one place decides when each is allowed and what booking again carries; the owner's cancel cases (18 Nov 2026) */
import { orderNote, shipment, shipmentManifest, shipmentPickup } from '@commerce/db'
import type { ShippingProvider } from '@commerce/shipping'
import { and, eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { unpackFulfillmentOrder } from '../order/fulfillment-orders'
import { recomputeOrderStatuses } from '../order/recompute'
import { recordRtoForShipment } from '../returns/rto'
import { releaseSharedOrders, sharedOrdersOf } from './shared-parcel'
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
    .select({
      status: shipment.status,
      fulfillmentOrderId: shipment.fulfillmentOrderId,
      reshippedAt: shipment.reshippedAt,
    })
    .from(shipment)
    .where(eq(shipment.orderId, orderId))
  // A lost parcel already sent again books like a cancelled label (shipment-lost.ts).
  const dropped = (r: (typeof rows)[number]) =>
    r.status === 'cancelled' || (r.status === 'lost' && r.reshippedAt !== null)
  const live = new Set(
    rows.filter((r) => !dropped(r) && r.status !== 'rto').map((r) => r.fulfillmentOrderId),
  )
  return new Set(
    rows
      .filter((r) => dropped(r) && !live.has(r.fulfillmentOrderId))
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
 * the pickup executive). The courier's pickup request stays: it simply finds one parcel fewer, so
 * the pickup's parcel count goes down by one (the Pickups list and the courier's expected count
 * stay true). True when the parcel was on a pickup or a manifest.
 */
async function leavePickup(
  ctx: StoreContext,
  row: { id: string; pickupId: string | null },
): Promise<boolean> {
  const manifests = await ctx.tx
    .update(shipmentManifest)
    .set({ shipmentIds: sql`array_remove(${shipmentManifest.shipmentIds}, ${row.id}::uuid)` })
    .where(
      and(
        eq(shipmentManifest.storeId, ctx.storeId),
        sql`${row.id}::uuid = any(${shipmentManifest.shipmentIds})`,
      ),
    )
    .returning({ id: shipmentManifest.id })
  if (row.pickupId) {
    await ctx.tx
      .update(shipmentPickup)
      .set({
        expectedPackageCount: sql`greatest(${shipmentPickup.expectedPackageCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(and(eq(shipmentPickup.id, row.pickupId), eq(shipmentPickup.storeId, ctx.storeId)))
  }
  return row.pickupId !== null || manifests.length > 0
}

/** A shipment that is not waiting on a pickup cannot go back to Booked. */
export class ShipmentNotOnPickup extends CommerceError {
  constructor(storeId?: string) {
    super('SHIPMENT_NOT_ON_PICKUP', 'This parcel is not on a pickup, so it is already in Booked.', {
      storeId,
    })
  }
}

/** A shipment in a state the asked-for way out does not fit; the message says why. */
export class ShipmentActionRefused extends CommerceError {
  constructor(message: string, storeId?: string) {
    super('SHIPMENT_ACTION_REFUSED', message, { storeId })
  }
}

/**
 * "Move back to Booked" refused: the courier schedules its own pickup at booking (RapidShyp,
 * capability `pickup_at_booking`) and that pickup can't be undone over its API, so taking the
 * parcel off it here only changed our record while the courier still came (owner, 23 Nov 2026).
 */
export class PickupScheduledByCourier extends ShipmentActionRefused {
  constructor(courierLabel: string, storeId?: string) {
    super(
      `${courierLabel} schedules its own pickup when you book. To stop the pickup, cancel the shipment.`,
      storeId,
    )
  }
}

export type ReturnToBookedOptions = {
  author?: string | null | undefined
  /** The courier's name when it schedules its own pickup at booking: the move is refused. */
  pickupByCourier?: string | null | undefined
}

/**
 * "Move back to Booked": the label stays live with the courier, the parcel leaves its pickup and
 * manifest, so it can go on another day's pickup. Only while it is still at the store, and never
 * for a courier that schedules its own pickup at booking (`PickupScheduledByCourier`).
 */
export async function returnShipmentToBooked(
  ctx: StoreContext,
  shipmentId: string,
  options: ReturnToBookedOptions = {},
): Promise<ShipmentRow> {
  const [row] = await ctx.tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new Error('shipment not found')
  if (options.pickupByCourier)
    throw new PickupScheduledByCourier(options.pickupByCourier, ctx.storeId)
  const block = cancelBlock(row, { courierCancels: true })
  if (block) throw new ShipmentNotCancellable(block, ctx.storeId)
  // On a pickup, or only on a printed manifest (made from a list of parcels, no pickup).
  if (!(await leavePickup(ctx, row))) throw new ShipmentNotOnPickup(ctx.storeId)
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
  await leavePickup(ctx, row)
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

/** Picked up and on its way: a cancel now is a return to the store (RTO), not a cancel. */
const MOVING: ReadonlySet<string> = new Set(['picked_up', 'in_transit', 'out_for_delivery'])

/**
 * "Cancel and bring it back": the courier already has the parcel, so the cancel goes to the
 * courier (Delhivery turns a cancel after pickup into a return) and the shipment moves to
 * Returned (RTO) at once, with the order's RTO task opened as a tracking RTO scan would.
 */
export async function returnShipmentToSender(
  ctx: StoreContext,
  provider: ShippingProvider,
  shipmentId: string,
  options: { author?: string | null | undefined; courierCancels?: boolean | undefined } = {},
): Promise<ShipmentRow> {
  const [row] = await ctx.tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new Error('shipment not found')
  if (!MOVING.has(row.status)) {
    throw new ShipmentActionRefused(
      'Only a parcel the courier has collected can be sent back. Cancel it instead.',
      ctx.storeId,
    )
  }
  if (options.courierCancels === false)
    throw new ShipmentNotCancellable('not_supported', ctx.storeId)
  await provider.cancel(row.providerRef || row.waybill, {
    waybill: row.waybill,
    providerRef: row.providerRef,
  })
  const [updated] = await ctx.tx
    .update(shipment)
    .set({ status: 'rto', updatedAt: new Date() })
    .where(eq(shipment.id, shipmentId))
    .returning()
  const moved = updated ?? row
  const carried = [
    { orderId: row.orderId, fulfillmentOrderId: row.fulfillmentOrderId },
    ...(await sharedOrdersOf(ctx, row.id)),
  ]
  for (const c of carried) {
    await recomputeOrderStatuses(ctx, c.orderId)
    await recordRtoForShipment(ctx, moved, c)
  }
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId: row.orderId,
    body: `Asked ${provider.label} to send AWB ${row.waybill} back. It is in Returned (RTO).`,
    author: options.author ?? null,
  })
  return moved
}

/**
 * "Already cancelled on the courier's app": nothing is sent to the courier. The shipment is
 * marked cancelled, leaves its pickup and manifest, and the packed order waits in To ship to be
 * booked again (with any courier). Not for a parcel delivered or already back.
 */
export async function markShipmentCancelled(
  ctx: StoreContext,
  shipmentId: string,
  options: { author?: string | null | undefined; courierLabel?: string | undefined } = {},
): Promise<ShipmentRow> {
  const [row] = await ctx.tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new Error('shipment not found')
  if (row.status !== 'created' && !MOVING.has(row.status)) {
    throw new ShipmentActionRefused(
      row.status === 'cancelled'
        ? 'This shipment is already cancelled.'
        : 'This parcel was delivered or returned, so there is nothing to cancel.',
      ctx.storeId,
    )
  }
  await leavePickup(ctx, row)
  const [updated] = await ctx.tx
    .update(shipment)
    .set({ status: 'cancelled', pickupId: null, updatedAt: new Date() })
    .where(eq(shipment.id, shipmentId))
    .returning()
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId: row.orderId,
    body: `Marked AWB ${row.waybill} as cancelled (cancelled on ${options.courierLabel ?? 'the courier'}'s own app). Its items stay packed, ready to book again.`,
    author: options.author ?? null,
  })
  await recomputeOrderStatuses(ctx, row.orderId)
  return updated ?? row
}
