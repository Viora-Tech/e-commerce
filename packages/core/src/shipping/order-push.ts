/** SOURCE OF TRUTH: pushPendingOrders, courierOrderFor — WHAT: sends new orders to courier apps that keep unbooked orders (Shiprocket, RapidShyp) as pending orders, and finds that pending order when the merchant books here / WHY: merchants who work from the courier's panel see every order there without booking anything; booking here reuses the same order instead of making a second one */
import { address, courierOrder, order, orderLine, shipment, variant } from '@commerce/db'
import {
  ASSUMED_WEIGHT_GRAMS,
  type CreateShipmentInput,
  isDomesticCountry,
  type PushOrderResult,
  type ShippingProvider,
  servesDestination,
} from '@commerce/shipping'
import { and, eq, gte, inArray, isNotNull, ne, notExists, or, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import type { ShippingSettings } from './settings'

/** Orders placed this long ago or less are sent; older ones were handled before this ran. */
const PUSH_WINDOW_DAYS = 3
/** Per store and courier per run, so one store with a backlog never holds the job up. */
const PUSH_BATCH = 25

/** Couriers in the store's list that can take a pending order. */
export const pushCouriers = (providers: readonly ShippingProvider[]) =>
  providers.filter((p) => typeof p.pushOrder === 'function')

/**
 * Orders ready to ship that this courier has not been sent: open, not a test or an imported
 * order, paid (or cash on delivery), nothing packed or booked yet, with a delivery address.
 */
async function ordersToPush(ctx: StoreContext, providerId: string) {
  return ctx.tx
    .select({ id: order.id })
    .from(order)
    .where(
      and(
        eq(order.status, 'open'),
        eq(order.isTest, false),
        sql`${order.importedFrom} is null`,
        isNotNull(order.shippingAddressId),
        eq(order.fulfillmentStatus, 'unfulfilled'),
        or(eq(order.paymentStatus, 'paid'), eq(order.paymentMethod, 'cod')),
        gte(order.placedAt, sql`now() - make_interval(days => ${PUSH_WINDOW_DAYS})`),
        notExists(
          ctx.tx
            .select({ one: sql`1` })
            .from(courierOrder)
            .where(and(eq(courierOrder.orderId, order.id), eq(courierOrder.provider, providerId))),
        ),
        notExists(
          ctx.tx
            .select({ one: sql`1` })
            .from(shipment)
            .where(and(eq(shipment.orderId, order.id), ne(shipment.status, 'cancelled'))),
        ),
      ),
    )
    .orderBy(order.placedAt)
    .limit(PUSH_BATCH)
}

/** The order as a courier booking: ship to its address, from the store's warehouse (state codes, as booking sends them). */
async function pushInputFor(
  ctx: StoreContext,
  orderId: string,
  settings: ShippingSettings,
  storeName: string,
): Promise<CreateShipmentInput | null> {
  const [o] = await ctx.tx
    .select({
      id: order.id,
      number: order.number,
      totalPaise: order.totalPaise,
      paymentMethod: order.paymentMethod,
      phone: order.phone,
      to: address,
    })
    .from(order)
    .innerJoin(address, eq(address.id, order.shippingAddressId))
    .where(eq(order.id, orderId))
  if (!o) return null
  const lines = await ctx.tx
    .select({
      title: orderLine.title,
      variantTitle: orderLine.variantTitle,
      quantity: orderLine.quantity,
      unitPricePaise: orderLine.unitPricePaise,
      weightGrams: variant.weightGrams,
      sku: variant.sku,
    })
    .from(orderLine)
    .leftJoin(variant, eq(variant.id, orderLine.variantId))
    .where(and(eq(orderLine.orderId, orderId), eq(orderLine.giftCard, false)))
  if (lines.length === 0) return null
  const weighed = lines.reduce((g, l) => g + (l.weightGrams ?? 0) * l.quantity, 0)
  const w = settings.policy.warehouse
  const cod = o.paymentMethod === 'cod'
  return {
    orderId: o.id,
    orderNumber: o.number,
    to: {
      name: o.to.name,
      line1: o.to.line1,
      line2: o.to.line2 ?? undefined,
      city: o.to.city,
      state: o.to.stateCode,
      pincode: o.to.pincode,
      // An order abroad (international checkout) keeps its ISO country code.
      country: isDomesticCountry(o.to.country) ? 'India' : o.to.country,
      phone: o.to.phone || o.phone || '',
    },
    from: {
      name: w.name || storeName,
      line1: w.line1,
      line2: w.line2 || undefined,
      city: w.city,
      state: w.state,
      pincode: settings.policy.originPincode,
      country: 'India',
      phone: w.phone,
    },
    lines: lines.map((l) => ({
      title: [l.title, l.variantTitle !== 'Default' ? l.variantTitle : null]
        .filter(Boolean)
        .join(' / '),
      quantity: l.quantity,
      unitPricePaise: l.unitPricePaise,
      sku: l.sku ?? undefined,
    })),
    paymentMode: cod ? 'cod' : 'prepaid',
    codAmountPaise: cod ? o.totalPaise : 0,
    valuePaise: o.totalPaise,
    weightGrams: weighed > 0 ? weighed : ASSUMED_WEIGHT_GRAMS,
  }
}

/**
 * Send one order to one courier and record the attempt (`pushed`, or `failed` with the
 * reason). True when sent, false when the courier refused, null when there was nothing to send.
 */
export async function pushOrderTo(
  ctx: StoreContext,
  provider: ShippingProvider,
  orderId: string,
  settings: ShippingSettings,
  storeName: string,
): Promise<boolean | null> {
  if (!provider.pushOrder) return null
  const input = await pushInputFor(ctx, orderId, settings, storeName)
  // A domestic courier is never sent an order abroad (nor an export-only one an Indian order).
  if (!input || !servesDestination(provider, input.to.country)) return null
  let result: PushOrderResult | null = null
  let error: string | null = null
  try {
    result = await provider.pushOrder(input)
  } catch (err) {
    error = err instanceof Error ? err.message.slice(0, 500) : 'Courier did not accept it'
  }
  await ctx.tx
    .insert(courierOrder)
    .values({
      storeId: ctx.storeId,
      orderId,
      provider: provider.id,
      externalOrderId: result?.externalOrderId ?? null,
      externalShipmentId: result?.externalShipmentId ?? null,
      status: result ? 'pushed' : 'failed',
      error,
    })
    .onConflictDoNothing()
  return result !== null
}

/**
 * Send each courier the store's new orders it has not had yet. Every attempt leaves a
 * `courier_order` row (`pushed`, or `failed` with the courier's reason), so an order is tried
 * once per courier and the order page can show where it went. Returns how many were sent.
 */
export async function pushPendingOrders(
  ctx: StoreContext,
  providers: readonly ShippingProvider[],
  settings: ShippingSettings,
  storeName: string,
): Promise<{ pushed: number; failed: number }> {
  let pushed = 0
  let failed = 0
  for (const provider of pushCouriers(providers)) {
    for (const { id } of await ordersToPush(ctx, provider.id)) {
      const ok = await pushOrderTo(ctx, provider, id, settings, storeName)
      if (ok === null) continue
      if (ok) pushed += 1
      else failed += 1
    }
  }
  return { pushed, failed }
}

/**
 * Take back pending orders whose order was cancelled here, so nobody books them from the
 * courier's panel. A courier that refuses keeps the row `pushed` with its reason in `error`
 * (the order page asks the merchant to cancel it there) and is tried again next run.
 */
export async function cancelPushedOrders(
  ctx: StoreContext,
  providers: readonly ShippingProvider[],
): Promise<{ cancelled: number; failed: number }> {
  const rows = await ctx.tx
    .select({
      id: courierOrder.id,
      provider: courierOrder.provider,
      externalOrderId: courierOrder.externalOrderId,
      externalShipmentId: courierOrder.externalShipmentId,
    })
    .from(courierOrder)
    .innerJoin(order, eq(order.id, courierOrder.orderId))
    .where(and(eq(courierOrder.status, 'pushed'), eq(order.status, 'cancelled')))
    .limit(PUSH_BATCH)
  let cancelled = 0
  let failed = 0
  for (const row of rows) {
    const provider = providers.find((p) => p.id === row.provider)
    if (!provider?.cancelPushedOrder || !row.externalOrderId) continue
    try {
      await provider.cancelPushedOrder({
        externalOrderId: row.externalOrderId,
        externalShipmentId: row.externalShipmentId ?? undefined,
      })
      await ctx.tx
        .update(courierOrder)
        .set({ status: 'cancelled', error: null, updatedAt: new Date() })
        .where(eq(courierOrder.id, row.id))
      cancelled += 1
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 500) : 'Courier refused'
      await ctx.tx
        .update(courierOrder)
        .set({ error: `Cancel failed: ${message}`, updatedAt: new Date() })
        .where(eq(courierOrder.id, row.id))
      failed += 1
    }
  }
  return { cancelled, failed }
}

/** Where this order was sent as a pending order, for the order page. */
export async function courierOrdersForOrder(ctx: StoreContext, orderId: string) {
  return ctx.tx
    .select({
      provider: courierOrder.provider,
      status: courierOrder.status,
      error: courierOrder.error,
      updatedAt: courierOrder.updatedAt,
    })
    .from(courierOrder)
    .where(eq(courierOrder.orderId, orderId))
}

/**
 * Send it again after a failure: the failed row goes, so the next run (or `pushPendingOrders`
 * right after) tries the order afresh.
 */
export async function retryCourierOrder(
  ctx: StoreContext,
  orderId: string,
  providerId: string,
): Promise<void> {
  await ctx.tx
    .delete(courierOrder)
    .where(
      and(
        eq(courierOrder.orderId, orderId),
        eq(courierOrder.provider, providerId),
        eq(courierOrder.status, 'failed'),
      ),
    )
}

/** The pending order this courier already holds for the order, to book instead of a new one. */
export async function courierOrderFor(
  ctx: StoreContext,
  orderId: string,
  providerId: string,
): Promise<PushOrderResult | undefined> {
  const [row] = await ctx.tx
    .select({
      externalOrderId: courierOrder.externalOrderId,
      externalShipmentId: courierOrder.externalShipmentId,
    })
    .from(courierOrder)
    .where(
      and(
        eq(courierOrder.orderId, orderId),
        eq(courierOrder.provider, providerId),
        inArray(courierOrder.status, ['pushed']),
      ),
    )
  if (!row?.externalOrderId) return undefined
  return {
    externalOrderId: row.externalOrderId,
    externalShipmentId: row.externalShipmentId ?? undefined,
  }
}

/** After booking here: that pending order is now a shipment. */
export async function markCourierOrderBooked(
  ctx: StoreContext,
  orderId: string,
  providerId: string,
): Promise<void> {
  await ctx.tx
    .update(courierOrder)
    .set({ status: 'booked', updatedAt: new Date() })
    .where(and(eq(courierOrder.orderId, orderId), eq(courierOrder.provider, providerId)))
}
