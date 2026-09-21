import { address, order, orderLine, shipment, store } from '@commerce/db'
import { ASSUMED_WEIGHT_GRAMS, type ShippingProvider, type Tracking } from '@commerce/shipping'
import { eq, inArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { parseShippingSettings } from './settings'

export type ShipmentRow = typeof shipment.$inferSelect

/** Statuses the tracking job keeps polling; the rest are terminal. */
export const OPEN_SHIPMENT_STATUSES = [
  'created',
  'picked_up',
  'in_transit',
  'out_for_delivery',
] as const

/**
 * Book a consignment with the courier for an order and record it.
 *
 * The order must have a shipping address. Parcel weight is assumed per line
 * until variants carry one (see ASSUMED_WEIGHT_GRAMS). The order is marked
 * fulfilled here because the label exists now; whether the courier has
 * collected it is what tracking is for.
 */
export async function createShipmentForOrder(
  ctx: StoreContext,
  provider: ShippingProvider,
  orderId: string,
): Promise<ShipmentRow> {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId))
  if (!o) throw new Error('order not found')
  if (!o.shippingAddressId) throw new Error('order has no shipping address')
  const [existing] = await ctx.tx.select().from(shipment).where(eq(shipment.orderId, orderId))
  if (existing && existing.status !== 'cancelled') return existing

  const [to] = await ctx.tx.select().from(address).where(eq(address.id, o.shippingAddressId))
  if (!to) throw new Error('shipping address not found')
  const [s] = await ctx.tx.select().from(store).where(eq(store.id, ctx.storeId))
  const settings = parseShippingSettings(s?.shipping)
  const lines = await ctx.tx.select().from(orderLine).where(eq(orderLine.orderId, orderId))
  const w = settings.policy.warehouse

  const result = await provider.createShipment({
    orderId: o.id,
    orderNumber: o.number,
    to: {
      name: to.name,
      line1: to.line1,
      line2: to.line2 ?? undefined,
      city: to.city,
      state: to.stateCode,
      pincode: to.pincode,
      country: to.country,
      phone: to.phone,
    },
    from: {
      name: w.name || s?.name || '',
      line1: w.line1,
      line2: w.line2 || undefined,
      city: w.city,
      state: w.state,
      pincode: settings.policy.originPincode,
      country: 'IN',
      phone: w.phone,
    },
    lines: lines.map((l) => ({
      title: [l.title, l.variantTitle !== 'Default' ? l.variantTitle : null]
        .filter(Boolean)
        .join(' / '),
      quantity: l.quantity,
      unitPricePaise: l.unitPricePaise,
    })),
    paymentMode: o.paymentMethod === 'cod' ? 'cod' : 'prepaid',
    codAmountPaise: o.paymentMethod === 'cod' ? o.totalPaise : 0,
    valuePaise: o.totalPaise,
    weightGrams: lines.reduce((g, l) => g + l.quantity * ASSUMED_WEIGHT_GRAMS, 0) || ASSUMED_WEIGHT_GRAMS,
  })

  const [row] = await ctx.tx
    .insert(shipment)
    .values({
      storeId: ctx.storeId,
      orderId: o.id,
      provider: provider.id,
      waybill: result.waybill,
      labelUrl: result.labelUrl ?? null,
    })
    .returning()
  if (!row) throw new Error('could not record shipment')
  if (o.status === 'placed' || o.status === 'paid') {
    await ctx.tx.update(order).set({ status: 'fulfilled' }).where(eq(order.id, o.id))
  }
  return row
}

/** Store a fresh Tracking answer; flips the order to delivered when the courier says so. */
export async function applyTracking(
  ctx: StoreContext,
  shipmentId: string,
  tracking: Tracking,
): Promise<{ shipment: ShipmentRow; becameDelivered: boolean }> {
  const [before] = await ctx.tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!before) throw new Error('shipment not found')
  const [row] = await ctx.tx
    .update(shipment)
    .set({
      status: tracking.status,
      tracking,
      trackingUrl: tracking.trackingUrl ?? before.trackingUrl,
      updatedAt: new Date(),
    })
    .where(eq(shipment.id, shipmentId))
    .returning()
  if (!row) throw new Error('shipment not found')
  const becameDelivered = before.status !== 'delivered' && tracking.status === 'delivered'
  if (becameDelivered) {
    await ctx.tx.update(order).set({ status: 'delivered' }).where(eq(order.id, row.orderId))
  }
  return { shipment: row, becameDelivered }
}

export async function cancelShipment(
  ctx: StoreContext,
  provider: ShippingProvider,
  shipmentId: string,
): Promise<ShipmentRow> {
  const [row] = await ctx.tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new Error('shipment not found')
  await provider.cancel(row.waybill)
  const [updated] = await ctx.tx
    .update(shipment)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(shipment.id, shipmentId))
    .returning()
  return updated ?? row
}

/** Shipments still moving, for the tracking job. */
export async function listOpenShipments(ctx: StoreContext): Promise<ShipmentRow[]> {
  return ctx.tx
    .select()
    .from(shipment)
    .where(inArray(shipment.status, [...OPEN_SHIPMENT_STATUSES]))
}
