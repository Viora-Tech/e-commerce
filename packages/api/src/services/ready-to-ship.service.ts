/** SOURCE OF TRUTH: listReadyToShip, countReadyToShip
 * WHAT:  Shipments › To book: one row per open parcel (an order shipping whole is one row), with
 *        "Part 2 of 2", the earlier part's ship date, the part's items and why it still waits.
 * WHY:   Partial shipments (Figma 918:10520): after Part 1 ships, Part 2 is its own row to book.
 * WHERE: shipments.readyToShip, shipments.counts (`toBook`).
 */
import { type LineAvailability, linesAvailability, waitingFor } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  address,
  customer,
  fulfillmentOrder,
  fulfillmentOrderLine,
  order,
  orderLine,
  shipment,
  variant,
} from '@commerce/db'
import { and, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

/** "1042" or "#1042" in a search box is an order number. */
export const orderNumberIn = (search: string | undefined): number | null =>
  search && /^#?\d{1,9}$/.test(search) ? Number(search.replace('#', '')) : null

export type ReadyToShipFilter = { page: number; perPage: number; search?: string | undefined }

export type ReadyToShipRow = {
  /** The row's own id: its parcel, or the order when it ships whole (no open parcel). */
  id: string
  orderId: string
  /** The open parcel this row books; null when the order ships whole. */
  fulfillmentOrderId: string | null
  orderNumber: number
  placedAt: Date
  customerName: string | null
  email: string | null
  city: string
  stateCode: string
  pincode: string
  itemsCount: number
  totalPaise: number
  isPreorder: boolean
  /** Sum of the lines' variant weights; null when no line's variant has a weight set. */
  weightGrams: number | null
  /** "Part 2 of 2": only when the order ships in more than one parcel. */
  part: { n: number; of: number } | null
  /** An earlier part already on its way ("Part 1 shipped 15 Oct"): the latest one. */
  shippedPart: { n: number; at: Date } | null
  /** What this row holds, for a part's Courier column ("Mouse Skates × 1, Wrist Rest × 1"). */
  items: Array<{ title: string; quantity: number }>
  /** Why it cannot all go yet ("Waiting · pre-order 22 Oct"); null when every unit is on the shelf. */
  waiting: { kind: 'preorder' | 'stock'; on: string | null } | null
}

/** Paid, unshipped, not cancelled and not on hold: the orders the To book tab lists. */
const readyToShipWhere = () =>
  and(
    inArray(order.paymentStatus, ['paid', 'partially_paid']),
    or(
      inArray(order.fulfillmentStatus, ['unfulfilled', 'partially_fulfilled']),
      /* Packed, but its label was cancelled and nothing replaced it: back on the list to book. */
      and(
        eq(order.fulfillmentStatus, 'fulfilled'),
        sql`exists (select 1 from ${shipment} where ${shipment.orderId} = ${order.id} and ${shipment.status} = 'cancelled')`,
        sql`not exists (select 1 from ${shipment} where ${shipment.orderId} = ${order.id} and ${shipment.status} not in ('cancelled', 'rto'))`,
      ),
    ),
    sql`${order.status} != 'cancelled'`,
    // Something on the order needs a courier: gift cards, services and downloads do not.
    sql`exists (select 1 from ${orderLine} l where l.order_id = ${order.id} and l.requires_shipping and not l.gift_card)`,
    // A held parcel (Hold fulfilment) keeps the order off the list until it is released.
    sql`not exists (select 1 from ${fulfillmentOrder} where ${fulfillmentOrder.orderId} = ${order.id} and ${fulfillmentOrder.heldAt} is not null and ${fulfillmentOrder.status} in ('open', 'on_hold'))`,
    // The older stand-in, kept for stores that mark holds with a tag.
    sql`not (${order.tags} && array['hold', 'on-hold']::text[])`,
  )

/**
 * One To book row per open parcel (Figma 918:10520): a parcel still holding units to send. An
 * order with none (older orders without parcels, a packed order whose label was cancelled) is
 * one row with no parcel, as before.
 */
const openParcel = alias(fulfillmentOrder, 'open_parcel')
const openParcelOn = () =>
  and(
    eq(openParcel.orderId, order.id),
    inArray(openParcel.status, ['open', 'on_hold']),
    isNull(openParcel.heldAt),
    sql`exists (select 1 from ${fulfillmentOrderLine} fol where fol.fulfillment_order_id = ${openParcel.id} and fol.quantity > fol.fulfilled_quantity)`,
  )

/** How many To book rows there are (open parcels, or orders shipping whole). */
export async function countReadyToShip(tx: StoreTx, where = readyToShipWhere()): Promise<number> {
  const [row] = await tx
    .select({ total: count() })
    .from(order)
    .innerJoin(address, eq(address.id, order.shippingAddressId))
    .leftJoin(customer, eq(customer.id, order.customerId))
    .leftJoin(openParcel, openParcelOn())
    .where(where)
  return row?.total ?? 0
}

type ReadyUnit = {
  /** The row it belongs to: its parcel, or the order shipping whole. */
  key: string
  orderLineId: string
  title: string
  quantity: number
  preorder: boolean
  weightGrams: number | null
}

/** What each row holds: an open parcel's unsent units, or a whole order's shipping lines. */
async function readyUnits(
  tx: StoreTx,
  parcelIds: string[],
  wholeIds: string[],
): Promise<ReadyUnit[]> {
  const inParcels =
    parcelIds.length === 0
      ? []
      : await tx
          .select({
            key: fulfillmentOrderLine.fulfillmentOrderId,
            orderLineId: orderLine.id,
            title: orderLine.title,
            quantity: sql<number>`${fulfillmentOrderLine.quantity} - ${fulfillmentOrderLine.fulfilledQuantity}`,
            preorder: orderLine.preorder,
            weightGrams: variant.weightGrams,
          })
          .from(fulfillmentOrderLine)
          .innerJoin(orderLine, eq(orderLine.id, fulfillmentOrderLine.orderLineId))
          .leftJoin(variant, eq(variant.id, orderLine.variantId))
          .where(
            and(
              inArray(fulfillmentOrderLine.fulfillmentOrderId, parcelIds),
              sql`${fulfillmentOrderLine.quantity} > ${fulfillmentOrderLine.fulfilledQuantity}`,
            ),
          )
          .orderBy(orderLine.id)
  const whole =
    wholeIds.length === 0
      ? []
      : await tx
          .select({
            key: orderLine.orderId,
            orderLineId: orderLine.id,
            title: orderLine.title,
            quantity: orderLine.quantity,
            preorder: orderLine.preorder,
            weightGrams: variant.weightGrams,
          })
          .from(orderLine)
          .leftJoin(variant, eq(variant.id, orderLine.variantId))
          .where(
            and(
              inArray(orderLine.orderId, wholeIds),
              eq(orderLine.requiresShipping, true),
              eq(orderLine.giftCard, false),
            ),
          )
          .orderBy(orderLine.id)
  return [...inParcels, ...whole].map((u) => ({
    ...u,
    title: u.title?.trim() || '—',
    quantity: Number(u.quantity),
  }))
}

/** Every parcel of these orders (for "Part 2 of 2") and their live labels ("Part 1 shipped"). */
async function orderParts(tx: StoreTx, orderIds: string[]) {
  if (orderIds.length === 0) return { parcels: [], labels: [] }
  const parcels = await tx
    .select({
      id: fulfillmentOrder.id,
      orderId: fulfillmentOrder.orderId,
      status: fulfillmentOrder.status,
    })
    .from(fulfillmentOrder)
    .where(inArray(fulfillmentOrder.orderId, orderIds))
    .orderBy(fulfillmentOrder.position)
  const labels = await tx
    .select({ parcelId: shipment.fulfillmentOrderId, at: shipment.createdAt })
    .from(shipment)
    .where(
      and(
        inArray(shipment.orderId, orderIds),
        sql`${shipment.status} not in ('cancelled', 'rto')`,
        isNotNull(shipment.fulfillmentOrderId),
      ),
    )
  return { parcels, labels }
}

export async function listReadyToShip(
  tx: StoreTx,
  input: ReadyToShipFilter,
): Promise<{ items: ReadyToShipRow[]; total: number }> {
  const orderNumber = orderNumberIn(input.search)
  const where = and(
    readyToShipWhere(),
    input.search
      ? or(
          ilike(order.email, `%${input.search}%`),
          ilike(address.name, `%${input.search}%`),
          ilike(address.pincode, `%${input.search}%`),
          orderNumber !== null ? eq(order.number, orderNumber) : undefined,
        )
      : undefined,
  )
  const rows = await tx
    .select({
      orderId: order.id,
      fulfillmentOrderId: openParcel.id,
      locationId: openParcel.locationId,
      orderNumber: order.number,
      placedAt: order.placedAt,
      email: order.email,
      totalPaise: order.totalPaise,
      customerName: sql<string | null>`coalesce(${address.name}, ${customer.name})`,
      city: address.city,
      stateCode: address.stateCode,
      pincode: address.pincode,
    })
    .from(order)
    .innerJoin(address, eq(address.id, order.shippingAddressId))
    .leftJoin(customer, eq(customer.id, order.customerId))
    .leftJoin(openParcel, openParcelOn())
    .where(where)
    .orderBy(desc(order.placedAt), desc(order.id), openParcel.position)
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  const total = await countReadyToShip(tx, where)

  const keyOf = (r: (typeof rows)[number]) => r.fulfillmentOrderId ?? r.orderId
  const units = await readyUnits(
    tx,
    rows.flatMap((r) => (r.fulfillmentOrderId ? [r.fulfillmentOrderId] : [])),
    rows.filter((r) => !r.fulfillmentOrderId).map((r) => r.orderId),
  )
  const { parcels, labels } = await orderParts(tx, [...new Set(rows.map((r) => r.orderId))])
  const unitsOf = (r: (typeof rows)[number]) => units.filter((u) => u.key === keyOf(r))
  const availability = await linesAvailability(
    tx,
    rows.flatMap((r) =>
      unitsOf(r).map((u) => ({
        orderLineId: u.orderLineId,
        quantity: u.quantity,
        locationId: r.locationId,
      })),
    ),
  )

  let next = 0
  const items = rows.map((r): ReadyToShipRow => {
    const own = unitsOf(r)
    const avail = own.map(() => availability[next++] as LineAvailability)
    const live = parcels.filter((p) => p.orderId === r.orderId && p.status !== 'cancelled')
    const n = live.findIndex((p) => p.id === r.fulfillmentOrderId) + 1
    const shipped = live
      .flatMap((p, i) =>
        labels.filter((l) => l.parcelId === p.id).map((l) => ({ n: i + 1, at: l.at })),
      )
      .filter((s) => s.n !== n)
      .sort((a, b) => b.at.getTime() - a.at.getTime())[0]
    const weighed = own.filter((u) => u.weightGrams !== null)
    return {
      id: keyOf(r),
      orderId: r.orderId,
      fulfillmentOrderId: r.fulfillmentOrderId,
      orderNumber: r.orderNumber,
      placedAt: r.placedAt,
      email: r.email,
      totalPaise: r.totalPaise,
      customerName: r.customerName,
      city: r.city,
      stateCode: r.stateCode,
      pincode: r.pincode,
      itemsCount: own.reduce((t, u) => t + u.quantity, 0),
      isPreorder: own.some((u) => u.preorder),
      weightGrams:
        weighed.length === 0
          ? null
          : weighed.reduce((t, u) => t + u.quantity * (u.weightGrams ?? 0), 0),
      part: n > 0 && live.length > 1 ? { n, of: live.length } : null,
      shippedPart: n > 0 && shipped ? shipped : null,
      items: own.map((u) => ({ title: u.title, quantity: u.quantity })),
      waiting: waitingFor(
        avail,
        own.map((u) => u.quantity),
      ),
    }
  })
  return { items, total }
}
