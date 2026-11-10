/** SOURCE OF TRUTH: groupIntoParcels, createFulfillmentOrders, ensureFulfillmentOrders,
 *   packFulfillmentOrderLines, releaseFulfillmentOrders, lineLocation, deleteFulfillmentOrders
 * WHAT:  An order's parcels (fulfilment orders): which location holds each unit, and moving
 *        that stock when units are packed, cancelled or returned.
 * WHY:   Stock is held at a location, so packing or cancelling must touch that location's
 *        inventory row, not whichever row the variant sells from today. Every placed order
 *        with goods has at least one parcel; orders placed before parcels existed (and any a
 *        migration missed) get theirs from `ensureFulfillmentOrders` on their next stock move.
 *        Gift card lines are vouchers and belong to no parcel.
 * WHERE: placeOrder and convertDraft create parcels where they reserved stock; fulfil.ts,
 *        cancelOrder and the returns service move stock through them. `order_line.
 *        fulfilled_quantity` stays the order-level total the statuses are derived from.
 */
import {
  type FulfillmentOrderStatus,
  fulfillmentOrder,
  fulfillmentOrderLine,
  gstRegistration,
  inventoryLevel,
  location,
  type OrderTaxOrigin,
  order,
  orderLine,
  type ParcelDeliveryEstimate,
  primarySellingLevel,
  type StoreTx,
  shipment,
} from '@commerce/db'
import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { defaultLocationId } from '../inventory/levels'
import {
  releaseCommittedStock,
  shipCommittedStock,
  unshipCommittedStock,
  writeOffCommittedStock,
} from './committed-stock'

/** One order line's units placed at a location. */
export type ParcelLineInput = {
  orderLineId: string
  quantity: number
  /** Already packed (orders that predate parcels); 0 for a new order. */
  fulfilledQuantity?: number | undefined
  /** Where the stock is held; null (untracked goods, no inventory row) means the default location. */
  locationId: string | null
}

/** One parcel to write: the location, and the order lines' units it holds. */
export type ParcelPlan = {
  locationId: string
  status: Extract<FulfillmentOrderStatus, 'open' | 'on_hold'>
  /** It holds more than its location has (order/routing.ts rule 4). */
  needsTransfer?: boolean | undefined
  /** Its share of the order's money and the GST in it (tax/parcel-gst.ts), when worked out. */
  money?: ParcelMoney | undefined
  /** When the shopper was told it arrives (checkout's courier estimate from its location). */
  deliveryEstimate?: ParcelDeliveryEstimate | null | undefined
  lines: { orderLineId: string; quantity: number; fulfilledQuantity: number }[]
}

/** A parcel's share of the order's money and tax, as stored on its fulfilment order. */
export type ParcelMoney = {
  subtotalPaise: number
  discountPaise: number
  adjustmentPaise: number
  shippingPaise: number
  totalPaise: number
  taxPaise: number
  taxBreakdown: unknown
  taxOrigin: OrderTaxOrigin
  /** The GSTIN the tax was split from; wins over the location's link. */
  gstRegistrationId: string | null
}

/**
 * Group an order's goods lines into parcels, one per location, the default location first,
 * then by location id so the numbering is stable. Lines with nothing to send are dropped.
 */
export function groupIntoParcels(
  lines: readonly ParcelLineInput[],
  defaultLocation: string,
): ParcelPlan[] {
  const byLocation = new Map<string, ParcelPlan>()
  for (const line of lines) {
    if (line.quantity <= 0) continue
    const at = line.locationId ?? defaultLocation
    const plan = byLocation.get(at) ?? { locationId: at, status: 'open', lines: [] }
    plan.lines.push({
      orderLineId: line.orderLineId,
      quantity: line.quantity,
      fulfilledQuantity: Math.min(Math.max(line.fulfilledQuantity ?? 0, 0), line.quantity),
    })
    byLocation.set(at, plan)
  }
  return [...byLocation.values()].sort(
    (a, b) =>
      Number(b.locationId === defaultLocation) - Number(a.locationId === defaultLocation) ||
      a.locationId.localeCompare(b.locationId),
  )
}

/** The active GSTIN billed for goods leaving each location; absent when none is linked. */
async function locationRegistrations(
  tx: StoreTx,
  locationIds: readonly string[],
): Promise<Map<string, string>> {
  if (locationIds.length === 0) return new Map()
  const rows = await tx
    .select({ locationId: location.id, registrationId: gstRegistration.id })
    .from(location)
    .innerJoin(gstRegistration, eq(gstRegistration.id, location.gstRegistrationId))
    .where(and(inArray(location.id, [...locationIds]), isNull(gstRegistration.cancelledAt)))
  return new Map(rows.map((r) => [r.locationId, r.registrationId]))
}

const statusAfterPacking = (plan: Pick<ParcelPlan, 'status' | 'lines'>): FulfillmentOrderStatus =>
  plan.lines.every((l) => l.fulfilledQuantity >= l.quantity) ? 'fulfilled' : plan.status

/**
 * Write parcels for an order, numbered after any it already has. Each parcel is billed under
 * its location's GSTIN, else `fallbackRegistrationId` (the order's). Returns the new ids.
 */
export async function createFulfillmentOrders(
  ctx: StoreContext,
  input: {
    orderId: string
    plans: readonly ParcelPlan[]
    fallbackRegistrationId: string | null
    /** Parcels of a cancelled order are written cancelled (orders older than parcels). */
    cancelled?: boolean | undefined
  },
): Promise<string[]> {
  if (input.plans.length === 0) return []
  const [last] = await ctx.tx
    .select({ position: fulfillmentOrder.position })
    .from(fulfillmentOrder)
    .where(eq(fulfillmentOrder.orderId, input.orderId))
    .orderBy(desc(fulfillmentOrder.position))
    .limit(1)
  const registrations = await locationRegistrations(
    ctx.tx,
    input.plans.map((p) => p.locationId),
  )
  const ids: string[] = []
  let position = last?.position ?? 0
  for (const plan of input.plans) {
    position += 1
    const [fo] = await ctx.tx
      .insert(fulfillmentOrder)
      .values({
        storeId: ctx.storeId,
        orderId: input.orderId,
        locationId: plan.locationId,
        gstRegistrationId: plan.money
          ? plan.money.gstRegistrationId
          : (registrations.get(plan.locationId) ?? input.fallbackRegistrationId),
        position,
        status: input.cancelled ? 'cancelled' : statusAfterPacking(plan),
        needsTransfer: plan.needsTransfer ?? false,
        deliveryEstimate: plan.deliveryEstimate ?? null,
        ...(plan.money ?? {}),
      })
      .returning({ id: fulfillmentOrder.id })
    if (!fo) throw new Error('fulfilment order insert returned nothing')
    await ctx.tx.insert(fulfillmentOrderLine).values(
      plan.lines.map((l) => ({
        storeId: ctx.storeId,
        fulfillmentOrderId: fo.id,
        orderLineId: l.orderLineId,
        quantity: l.quantity,
        fulfilledQuantity: l.fulfilledQuantity,
      })),
    )
    ids.push(fo.id)
  }
  return ids
}

/** The location each variant mainly sells online from (`primarySellingLevel`). */
export async function sellingLocations(
  tx: StoreTx,
  variantIds: readonly string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(variantIds)]
  if (ids.length === 0) return new Map()
  const rows = await tx
    .select({ variantId: inventoryLevel.variantId, locationId: inventoryLevel.locationId })
    .from(inventoryLevel)
    .where(
      and(inArray(inventoryLevel.variantId, ids), primarySellingLevel(inventoryLevel.variantId)),
    )
  return new Map(rows.flatMap((r) => (r.locationId ? [[r.variantId, r.locationId] as const] : [])))
}

/**
 * The order's parcels, made now when it has none: an order placed before parcels existed
 * holds its stock where each variant sells from, so that is where its parcels go. Drafts hold
 * no stock and get none. Locks the order row so two callers cannot both create them.
 */
export async function ensureFulfillmentOrders(ctx: StoreContext, orderId: string): Promise<void> {
  const [o] = await ctx.tx
    .select({
      status: order.status,
      gstRegistrationId: order.gstRegistrationId,
    })
    .from(order)
    .where(eq(order.id, orderId))
    .for('update')
  if (!o || o.status === 'draft') return
  const [existing] = await ctx.tx
    .select({ id: fulfillmentOrder.id })
    .from(fulfillmentOrder)
    .where(eq(fulfillmentOrder.orderId, orderId))
    .limit(1)
  if (existing) return
  const lines = await ctx.tx
    .select({
      id: orderLine.id,
      variantId: orderLine.variantId,
      quantity: orderLine.quantity,
      fulfilledQuantity: orderLine.fulfilledQuantity,
    })
    .from(orderLine)
    .where(and(eq(orderLine.orderId, orderId), eq(orderLine.giftCard, false)))
  if (lines.length === 0) return
  const selling = await sellingLocations(
    ctx.tx,
    lines.map((l) => l.variantId),
  )
  const plans = groupIntoParcels(
    lines.map((l) => ({
      orderLineId: l.id,
      quantity: l.quantity,
      fulfilledQuantity: l.fulfilledQuantity,
      locationId: selling.get(l.variantId) ?? null,
    })),
    await defaultLocationId(ctx.tx, ctx.storeId),
  )
  await createFulfillmentOrders(ctx, {
    orderId,
    plans,
    fallbackRegistrationId: o.gstRegistrationId,
    cancelled: o.status === 'cancelled',
  })
}

type ParcelRow = {
  id: string
  fulfillmentOrderId: string
  orderLineId: string
  variantId: string
  quantity: number
  fulfilledQuantity: number
  locationId: string
  status: FulfillmentOrderStatus
}

/** Every parcel line of an order with its parcel's location, in parcel order, locked. */
async function lockParcelLines(ctx: StoreContext, orderId: string): Promise<ParcelRow[]> {
  return ctx.tx
    .select({
      id: fulfillmentOrderLine.id,
      fulfillmentOrderId: fulfillmentOrderLine.fulfillmentOrderId,
      orderLineId: fulfillmentOrderLine.orderLineId,
      variantId: orderLine.variantId,
      quantity: fulfillmentOrderLine.quantity,
      fulfilledQuantity: fulfillmentOrderLine.fulfilledQuantity,
      locationId: fulfillmentOrder.locationId,
      status: fulfillmentOrder.status,
    })
    .from(fulfillmentOrderLine)
    .innerJoin(fulfillmentOrder, eq(fulfillmentOrder.id, fulfillmentOrderLine.fulfillmentOrderId))
    .innerJoin(orderLine, eq(orderLine.id, fulfillmentOrderLine.orderLineId))
    .where(eq(fulfillmentOrder.orderId, orderId))
    .orderBy(asc(fulfillmentOrder.position), asc(fulfillmentOrderLine.id))
    .for('update', { of: fulfillmentOrderLine })
}

/** A parcel whose every unit is packed is fulfilled; cancelled ones stay cancelled. */
async function settleStatuses(ctx: StoreContext, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return
  await ctx.tx
    .update(fulfillmentOrder)
    .set({
      status: sql`case when not exists (
        select 1 from ${fulfillmentOrderLine} l
        where l.fulfillment_order_id = ${fulfillmentOrder.id} and l.fulfilled_quantity < l.quantity
      ) then 'fulfilled' else ${fulfillmentOrder.status} end`,
      updatedAt: new Date(),
    })
    .where(and(inArray(fulfillmentOrder.id, [...ids]), ne(fulfillmentOrder.status, 'cancelled')))
}

export type PackPick = { orderLineId: string; variantId: string; quantity: number }

/** Units packed out of one parcel: what the shipment for that parcel carries. */
export type PackedUnits = { fulfillmentOrderId: string; orderLineId: string; quantity: number }

/**
 * Pack units of an order's lines: each unit comes out of the first parcel (in parcel order)
 * that still holds it unpacked, and leaves stock at that parcel's location. The caller moves
 * `order_line.fulfilled_quantity` and has already checked the quantities against it. Units no
 * parcel holds (a parcel row lost or edited by hand) still leave stock where the variant sells.
 * `onlyParcel` packs from that one parcel (a courier booking for that parcel alone).
 */
export async function packFulfillmentOrderLines(
  ctx: StoreContext,
  orderId: string,
  picks: readonly PackPick[],
  onlyParcel?: string | undefined,
): Promise<PackedUnits[]> {
  await ensureFulfillmentOrders(ctx, orderId)
  const rows = await lockParcelLines(ctx, orderId)
  const packed: PackedUnits[] = []
  for (const pick of picks) {
    let remaining = pick.quantity
    for (const row of rows) {
      if (remaining <= 0) break
      if (row.orderLineId !== pick.orderLineId || row.status === 'cancelled') continue
      if (onlyParcel && row.fulfillmentOrderId !== onlyParcel) continue
      const take = Math.min(remaining, row.quantity - row.fulfilledQuantity)
      if (take <= 0) continue
      await ctx.tx
        .update(fulfillmentOrderLine)
        .set({ fulfilledQuantity: sql`${fulfillmentOrderLine.fulfilledQuantity} + ${take}` })
        .where(eq(fulfillmentOrderLine.id, row.id))
      row.fulfilledQuantity += take
      await shipCommittedStock(ctx, {
        variantId: row.variantId,
        quantity: take,
        locationId: row.locationId,
      })
      packed.push({
        fulfillmentOrderId: row.fulfillmentOrderId,
        orderLineId: row.orderLineId,
        quantity: take,
      })
      remaining -= take
    }
    if (remaining > 0) {
      await shipCommittedStock(ctx, { variantId: pick.variantId, quantity: remaining })
    }
  }
  await settleStatuses(ctx, [...new Set(packed.map((p) => p.fulfillmentOrderId))])
  return packed
}

/**
 * A cancelled order gives back every unit its parcels hold unpacked, at each parcel's
 * location (or, with `restock: false`, writes them off so availability stays as it was). Parcels with nothing packed become cancelled; one that already left keeps its
 * status (fulfilled) and a part-packed one is cancelled for the rest.
 */
export async function releaseFulfillmentOrders(
  ctx: StoreContext,
  orderId: string,
  opts: {
    /** False: the unpacked units do not go back on sale (written off instead). */
    restock?: boolean | undefined
  } = {},
): Promise<void> {
  await ensureFulfillmentOrders(ctx, orderId)
  const rows = await lockParcelLines(ctx, orderId)
  const touched = new Set<string>()
  for (const row of rows) {
    if (row.status === 'cancelled') continue
    const unpacked = row.quantity - row.fulfilledQuantity
    if (unpacked <= 0) continue
    const move = { variantId: row.variantId, quantity: unpacked, locationId: row.locationId }
    if (opts.restock === false) await writeOffCommittedStock(ctx, move)
    else await releaseCommittedStock(ctx, move)
    touched.add(row.fulfillmentOrderId)
  }
  if (touched.size === 0) return
  await ctx.tx
    .update(fulfillmentOrder)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(inArray(fulfillmentOrder.id, [...touched]))
}

/**
 * The location an order line's units left from, so a return goes back there: the parcel that
 * packed the most of it. Undefined when no parcel packed it (the caller falls back to where the
 * variant sells).
 */
export async function lineLocation(
  ctx: StoreContext,
  orderLineId: string,
): Promise<string | undefined> {
  const [row] = await ctx.tx
    .select({ locationId: fulfillmentOrder.locationId })
    .from(fulfillmentOrderLine)
    .innerJoin(fulfillmentOrder, eq(fulfillmentOrder.id, fulfillmentOrderLine.fulfillmentOrderId))
    .where(eq(fulfillmentOrderLine.orderLineId, orderLineId))
    .orderBy(desc(fulfillmentOrderLine.fulfilledQuantity), asc(fulfillmentOrder.position))
    .limit(1)
  return row?.locationId
}

/** The order's only live parcel, for a shipment that carries the whole order; null otherwise. */
export async function soleFulfillmentOrder(
  ctx: StoreContext,
  orderId: string,
): Promise<string | null> {
  const rows = await ctx.tx
    .select({ id: fulfillmentOrder.id })
    .from(fulfillmentOrder)
    .where(and(eq(fulfillmentOrder.orderId, orderId), ne(fulfillmentOrder.status, 'cancelled')))
    .limit(2)
  return rows.length === 1 ? (rows[0]?.id ?? null) : null
}

/**
 * Remove an order's parcels before its lines are deleted (a failed checkout undone, an
 * imported order rewritten). Shipments and invoices that pointed at them keep their order and
 * lose the link.
 */
export async function deleteFulfillmentOrders(tx: StoreTx, orderId: string): Promise<void> {
  const ids = (
    await tx
      .select({ id: fulfillmentOrder.id })
      .from(fulfillmentOrder)
      .where(eq(fulfillmentOrder.orderId, orderId))
  ).map((r) => r.id)
  if (ids.length === 0) return
  await tx
    .update(shipment)
    .set({ fulfillmentOrderId: null })
    .where(inArray(shipment.fulfillmentOrderId, ids))
  // GST invoices (an app's table, same database) keep their order and lose the parcel link.
  await tx.execute(
    sql`update invoice set fulfillment_order_id = null where fulfillment_order_id in (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})`,
  )
  await tx.delete(fulfillmentOrder).where(inArray(fulfillmentOrder.id, ids))
}

/**
 * Unpack a parcel whose label was cancelled: its packed units go back to To ship, on the order
 * line and the parcel line, and back into stock at the parcel's location. `fulfillmentOrderId`
 * null (a shipment from before parcels) unpacks every parcel of the order. Returns how many
 * units came back. Running it again finds nothing packed and moves nothing.
 */
export async function unpackFulfillmentOrder(
  ctx: StoreContext,
  orderId: string,
  fulfillmentOrderId: string | null,
): Promise<number> {
  const rows = (await lockParcelLines(ctx, orderId)).filter(
    (r) =>
      r.fulfilledQuantity > 0 &&
      r.status !== 'cancelled' &&
      (fulfillmentOrderId === null || r.fulfillmentOrderId === fulfillmentOrderId),
  )
  let units = 0
  for (const row of rows) {
    const n = row.fulfilledQuantity
    await ctx.tx
      .update(fulfillmentOrderLine)
      .set({ fulfilledQuantity: 0 })
      .where(eq(fulfillmentOrderLine.id, row.id))
    await ctx.tx
      .update(orderLine)
      .set({ fulfilledQuantity: sql`greatest(0, ${orderLine.fulfilledQuantity} - ${n})` })
      .where(eq(orderLine.id, row.orderLineId))
    await unshipCommittedStock(ctx, {
      variantId: row.variantId,
      quantity: n,
      locationId: row.locationId,
    })
    units += n
  }
  const parcels = [...new Set(rows.map((r) => r.fulfillmentOrderId))]
  if (parcels.length > 0) {
    await ctx.tx
      .update(fulfillmentOrder)
      .set({ status: 'open', updatedAt: new Date() })
      .where(and(inArray(fulfillmentOrder.id, parcels), eq(fulfillmentOrder.status, 'fulfilled')))
  }
  return units
}
