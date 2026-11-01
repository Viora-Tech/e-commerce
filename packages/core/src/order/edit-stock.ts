/** SOURCE OF TRUTH: releaseLineUnits, holdAddedUnits, settleEditedParcels, retaxOrder — WHAT: what an order edit does to parcels, committed stock and GST / WHY: an edited order must hold exactly the stock and charge exactly the GST of an order placed with the new lines */
import {
  address,
  fulfillmentOrder,
  fulfillmentOrderLine,
  order,
  orderLine,
  store,
} from '@commerce/db'
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { StoreAddressSchema } from '../settings/general'
import type { OrderGst } from '../tax/gst'
import { mergeOrderGst } from '../tax/parcel-gst'
import { chargedGstRate, parseStoreTax } from '../tax/settings'
import { releaseCommittedStock, writeOffCommittedStock } from './committed-stock'
import { createFulfillmentOrders } from './fulfillment-orders'
import { taxParcels } from './parcel-tax'
import type { RoutedParcel } from './routing'
import { routeAndReserve } from './routing-service'

/** The order's live parcel lines for one order line, newest parcel first, locked. */
async function lineParcels(ctx: StoreContext, orderId: string, orderLineId: string) {
  return ctx.tx
    .select({
      id: fulfillmentOrderLine.id,
      quantity: fulfillmentOrderLine.quantity,
      fulfilledQuantity: fulfillmentOrderLine.fulfilledQuantity,
      locationId: fulfillmentOrder.locationId,
    })
    .from(fulfillmentOrderLine)
    .innerJoin(fulfillmentOrder, eq(fulfillmentOrder.id, fulfillmentOrderLine.fulfillmentOrderId))
    .where(
      and(
        eq(fulfillmentOrder.orderId, orderId),
        eq(fulfillmentOrderLine.orderLineId, orderLineId),
        ne(fulfillmentOrder.status, 'cancelled'),
      ),
    )
    .orderBy(desc(fulfillmentOrder.position))
    .for('update', { of: fulfillmentOrderLine })
}

/**
 * Units taken off a line: each comes out of the newest parcel still holding it unpacked and its
 * committed stock is released at that parcel's location (on hand stays), or written off with
 * `restock: false` (on hand drops too). `remove` drops the line's parcel rows altogether (the
 * order line itself is about to go).
 */
export async function releaseLineUnits(
  ctx: StoreContext,
  input: {
    orderId: string
    orderLineId: string
    variantId: string
    quantity: number
    remove: boolean
    /** False: the units are not put back on sale ("Restock" off). */
    restock?: boolean | undefined
  },
): Promise<void> {
  const free = (move: { variantId: string; quantity: number; locationId?: string }) =>
    input.restock === false
      ? writeOffCommittedStock(ctx, move, 'Removed in an order edit without restocking')
      : releaseCommittedStock(ctx, move)
  let left = input.quantity
  for (const row of await lineParcels(ctx, input.orderId, input.orderLineId)) {
    const take = Math.min(left, row.quantity - row.fulfilledQuantity)
    if (take > 0) {
      await free({
        variantId: input.variantId,
        quantity: take,
        locationId: row.locationId,
      })
      left -= take
    }
    if (input.remove) {
      await ctx.tx.delete(fulfillmentOrderLine).where(eq(fulfillmentOrderLine.id, row.id))
    } else if (take > 0) {
      await ctx.tx
        .update(fulfillmentOrderLine)
        .set({ quantity: row.quantity - take })
        .where(eq(fulfillmentOrderLine.id, row.id))
    }
  }
  // Units no parcel held (a parcel row lost or edited by hand) still leave where they sell.
  if (left > 0) {
    await free({ variantId: input.variantId, quantity: left })
  }
}

export type AddedUnits = { orderLineId: string; variantId: string; quantity: number }

/**
 * Units added to the order: routed and held like a checkout (OutOfStock when the store cannot
 * cover them), each into the order's open parcel at that location when there is one, else a new
 * parcel numbered after the others.
 */
export async function holdAddedUnits(
  ctx: StoreContext,
  input: { orderId: string; units: readonly AddedUnits[]; registrationId: string | null },
): Promise<void> {
  if (input.units.length === 0) return
  const [o] = await ctx.tx
    .select({ shippingAddressId: order.shippingAddressId })
    .from(order)
    .where(eq(order.id, input.orderId))
  const [shipTo] = o?.shippingAddressId
    ? await ctx.tx
        .select({ stateCode: address.stateCode })
        .from(address)
        .where(eq(address.id, o.shippingAddressId))
    : []
  const { parcels } = await routeAndReserve(ctx, {
    lines: input.units.map((u) => ({
      key: u.orderLineId,
      variantId: u.variantId,
      quantity: u.quantity,
      giftCard: false,
      preorder: null,
    })),
    buyerState: shipTo?.stateCode ?? null,
  })
  const open = await ctx.tx
    .select({ id: fulfillmentOrder.id, locationId: fulfillmentOrder.locationId })
    .from(fulfillmentOrder)
    .where(and(eq(fulfillmentOrder.orderId, input.orderId), eq(fulfillmentOrder.status, 'open')))
    .orderBy(asc(fulfillmentOrder.position))
  const fresh: RoutedParcel[] = []
  for (const parcel of parcels) {
    const into =
      parcel.status === 'open' ? open.find((p) => p.locationId === parcel.locationId) : undefined
    if (!into) {
      fresh.push(parcel)
      continue
    }
    for (const l of parcel.lines) {
      await ctx.tx
        .insert(fulfillmentOrderLine)
        .values({
          storeId: ctx.storeId,
          fulfillmentOrderId: into.id,
          orderLineId: l.key,
          quantity: l.quantity,
          fulfilledQuantity: 0,
        })
        .onConflictDoUpdate({
          target: [fulfillmentOrderLine.fulfillmentOrderId, fulfillmentOrderLine.orderLineId],
          set: { quantity: sql`${fulfillmentOrderLine.quantity} + ${l.quantity}` },
        })
    }
  }
  await createFulfillmentOrders(ctx, {
    orderId: input.orderId,
    plans: fresh.map((p) => ({
      locationId: p.locationId,
      status: p.status,
      needsTransfer: p.needsTransfer,
      lines: p.lines.map((l) => ({
        orderLineId: l.key,
        quantity: l.quantity,
        fulfilledQuantity: 0,
      })),
    })),
    fallbackRegistrationId: input.registrationId,
  })
}

/**
 * After the lines moved: a parcel left with nothing to send is cancelled, one whose every unit
 * is packed is fulfilled.
 */
export async function settleEditedParcels(ctx: StoreContext, orderId: string): Promise<void> {
  await ctx.tx
    .update(fulfillmentOrder)
    .set({
      status: sql`case
        when coalesce((select sum(l.quantity) from ${fulfillmentOrderLine} l
          where l.fulfillment_order_id = ${fulfillmentOrder.id}), 0) = 0 then 'cancelled'
        when not exists (select 1 from ${fulfillmentOrderLine} l
          where l.fulfillment_order_id = ${fulfillmentOrder.id} and l.fulfilled_quantity < l.quantity)
          then 'fulfilled'
        else ${fulfillmentOrder.status} end`,
      updatedAt: new Date(),
    })
    .where(and(eq(fulfillmentOrder.orderId, orderId), ne(fulfillmentOrder.status, 'cancelled')))
}

type ParcelRow = {
  id: string
  locationId: string
  status: string
  subtotalPaise: number | null
  discountPaise: number | null
  adjustmentPaise: number | null
  shippingPaise: number | null
  totalPaise: number | null
  taxBreakdown: unknown
}

const isGst = (v: unknown): v is OrderGst =>
  typeof v === 'object' && v !== null && Array.isArray((v as OrderGst).byRate)

/**
 * A packed parcel the edit did not reprice keeps its money: it has gone out (or is ready to)
 * with its invoice and amount to collect, and an edit after shipping must not move them.
 */
const frozen = (p: ParcelRow, lineIds: readonly string[], repriced: ReadonlySet<string>) =>
  p.status === 'fulfilled' &&
  p.subtotalPaise !== null &&
  p.discountPaise !== null &&
  p.adjustmentPaise !== null &&
  p.shippingPaise !== null &&
  p.totalPaise !== null &&
  isGst(p.taxBreakdown) &&
  !lineIds.some((id) => repriced.has(id))

/**
 * Work the order's GST out again from its live parcels, as checkout does (`taxParcels`), and
 * store each parcel's share and the order's sum. Lines keep the rate they were charged at; an
 * order with no goods parcels (gift cards only) keeps its tax. When some parcels are packed and
 * untouched (an edit after shipping), they keep their shares and the rest of the order's
 * discount, fee and shipping is shared over the other parcels, so the parcel that left still
 * matches its invoice; when the rest cannot carry it (nothing else open, or the charges went
 * below what the packed parcels hold), every parcel is worked out again.
 */
export async function retaxOrder(
  ctx: StoreContext,
  orderId: string,
  opts: { repriced?: ReadonlySet<string> } = {},
): Promise<void> {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId))
  if (!o) return
  const all: ParcelRow[] = await ctx.tx
    .select({
      id: fulfillmentOrder.id,
      locationId: fulfillmentOrder.locationId,
      status: fulfillmentOrder.status,
      subtotalPaise: fulfillmentOrder.subtotalPaise,
      discountPaise: fulfillmentOrder.discountPaise,
      adjustmentPaise: fulfillmentOrder.adjustmentPaise,
      shippingPaise: fulfillmentOrder.shippingPaise,
      totalPaise: fulfillmentOrder.totalPaise,
      taxBreakdown: fulfillmentOrder.taxBreakdown,
    })
    .from(fulfillmentOrder)
    .where(and(eq(fulfillmentOrder.orderId, orderId), ne(fulfillmentOrder.status, 'cancelled')))
    .orderBy(asc(fulfillmentOrder.position))
  if (all.length === 0) return
  const parcelLines = await ctx.tx
    .select({
      fulfillmentOrderId: fulfillmentOrderLine.fulfillmentOrderId,
      orderLineId: fulfillmentOrderLine.orderLineId,
      quantity: fulfillmentOrderLine.quantity,
    })
    .from(fulfillmentOrderLine)
    .innerJoin(fulfillmentOrder, eq(fulfillmentOrder.id, fulfillmentOrderLine.fulfillmentOrderId))
    .where(eq(fulfillmentOrder.orderId, orderId))
  const lines = await ctx.tx.select().from(orderLine).where(eq(orderLine.orderId, orderId))
  const byId = new Map(lines.map((l) => [l.id, l]))
  const repriced = opts.repriced ?? new Set<string>()
  const linesOf = (id: string) =>
    parcelLines.filter((l) => l.fulfillmentOrderId === id).map((l) => l.orderLineId)
  const kept = all.filter((p) => frozen(p, linesOf(p.id), repriced))
  const sum = (key: 'discountPaise' | 'adjustmentPaise' | 'shippingPaise') =>
    kept.reduce((n, p) => n + (p[key] ?? 0), 0)
  const rest = {
    discountPaise: o.discountPaise - sum('discountPaise'),
    adjustmentPaise: o.paymentAdjustmentPaise - sum('adjustmentPaise'),
    shippingPaise: o.shippingPaise - sum('shippingPaise'),
  }
  const restGross = parcelLines
    .filter((l) => !kept.some((p) => p.id === l.fulfillmentOrderId))
    .reduce((n, l) => n + l.quantity * (byId.get(l.orderLineId)?.unitPricePaise ?? 0), 0)
  const split =
    kept.length > 0 &&
    kept.length < all.length &&
    rest.discountPaise >= 0 &&
    rest.discountPaise <= restGross &&
    rest.shippingPaise >= 0 &&
    (rest.adjustmentPaise === 0 ||
      Math.sign(rest.adjustmentPaise) === Math.sign(o.paymentAdjustmentPaise))
  const parcels = split ? all.filter((p) => !kept.includes(p)) : all
  const [s] = await ctx.tx
    .select({ address: store.address, gstRatePercent: store.gstRatePercent, apps: store.apps })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const storeTax = parseStoreTax(s?.apps)
  const storeAddress = StoreAddressSchema.safeParse(s?.address ?? {})
  const [shipTo] = o.shippingAddressId
    ? await ctx.tx
        .select({ stateCode: address.stateCode })
        .from(address)
        .where(eq(address.id, o.shippingAddressId))
    : []
  const routed: RoutedParcel[] = parcels.map((p) => ({
    locationId: p.locationId,
    status: 'open',
    needsTransfer: false,
    lines: parcelLines
      .filter((l) => l.fulfillmentOrderId === p.id && l.quantity > 0)
      .map((l) => ({ key: l.orderLineId, quantity: l.quantity })),
  }))
  const billed = await taxParcels(ctx.tx, {
    parcels: routed,
    lineOf: (key, quantity) => {
      const line = byId.get(key)
      return {
        grossPaise: quantity * (line?.unitPricePaise ?? 0),
        ratePercent:
          !line || line.giftCard
            ? 0
            : (line.gstRatePercent ?? chargedGstRate(s?.gstRatePercent ?? 18, storeTax)),
      }
    },
    discountPaise: split ? rest.discountPaise : o.discountPaise,
    adjustmentPaise: split ? rest.adjustmentPaise : o.paymentAdjustmentPaise,
    shippingPaise: split ? rest.shippingPaise : o.shippingPaise,
    shipToState: shipTo?.stateCode ?? null,
    storeState: storeAddress.success ? storeAddress.data.state : null,
  })
  for (const [i, p] of parcels.entries()) {
    const money = billed.money[i]
    if (money) {
      await ctx.tx
        .update(fulfillmentOrder)
        .set({ ...money, updatedAt: new Date() })
        .where(eq(fulfillmentOrder.id, p.id))
    }
  }
  const tax =
    billed.tax && split
      ? mergeOrderGst([...kept.map((p) => p.taxBreakdown as OrderGst), billed.tax])
      : billed.tax
  if (tax) {
    await ctx.tx
      .update(order)
      .set({ taxPaise: tax.taxPaise, taxBreakdown: tax })
      .where(eq(order.id, orderId))
  }
}
