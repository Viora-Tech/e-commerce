import {
  activeDeliveryConfig,
  assignBadges,
  bookingContext,
  bookingPlan,
  bulkCreateShipments,
  chooseCourier,
  compareCourierRates,
  createShipmentForOrder,
  primaryShippingProvider,
  resolveShippingProviders,
  type ShippingRegistry,
  shipmentLabelUrl,
  shippingProviderById,
} from '@commerce/core'
import { SHIPMENT_TAB_STATUSES } from '@commerce/core/shipment-tabs'
import { startOfDay } from '@commerce/dates'
import type { StoreTx } from '@commerce/db'
import {
  address,
  customer,
  fulfillmentOrder,
  order,
  orderLine,
  shipment,
  variant,
} from '@commerce/db'
import {
  ASSUMED_WEIGHT_GRAMS,
  CourierError,
  describeCourierFailure,
  type RateQuery,
} from '@commerce/shipping'
import { ORPCError } from '@orpc/server'
import { and, count, desc, eq, gte, ilike, inArray, lt, ne, or, sql } from 'drizzle-orm'
import { loadShippingSettings, noteShipmentBooked } from './shipping.service'

export const courierToRpc = (err: unknown): never => {
  if (err instanceof CourierError) {
    const detail = err.kind === 'rejected' ? err.message : describeCourierFailure(err)
    throw new ORPCError('BAD_REQUEST', { message: detail })
  }
  if (err instanceof Error) throw new ORPCError('BAD_REQUEST', { message: err.message })
  throw err
}

export async function requireProvider(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
) {
  const provider = primaryShippingProvider(
    registry,
    await loadShippingSettings(tx, storeId),
    secret,
  )
  if (!provider) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Enable a courier first.' })
  }
  return provider
}

/** The courier that actually holds a shipment's waybill - by the id stored on the row, not
 *  whichever courier happens to be first in the enabled list. Required for any action on an
 *  *existing* shipment (NDR, cancel, tracking) once a store has more than one courier connected. */
export async function requireProviderById(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  providerId: string,
) {
  const provider = shippingProviderById(
    registry,
    await loadShippingSettings(tx, storeId),
    secret,
    providerId,
  )
  if (!provider) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: `Courier ${providerId} is no longer enabled.`,
    })
  }
  return provider
}

type OrderShippingContext = {
  orderId: string
  orderNumber: number
  pincode: string
  stateCode: string | null
  /** ISO alpha-2; 'IN' for every Indian address. */
  country: string
  city: string
  totalPaise: number
  paymentMethod: string | null
}

/** Destination, value and payment mode for a batch of orders, joined once rather than per order.
 *  Orders with no shipping address are silently skipped here - the caller reports them as
 *  individual booking failures, same as `createShipmentForOrder` does for a single order. */
async function loadOrderShippingContexts(
  tx: StoreTx,
  orderIds: string[],
): Promise<OrderShippingContext[]> {
  if (orderIds.length === 0) return []
  const rows = await tx
    .select({
      orderId: order.id,
      orderNumber: order.number,
      totalPaise: order.totalPaise,
      paymentMethod: order.paymentMethod,
      pincode: address.pincode,
      stateCode: address.stateCode,
      country: address.country,
      city: address.city,
    })
    .from(order)
    .innerJoin(address, eq(address.id, order.shippingAddressId))
    .where(inArray(order.id, orderIds))
  return rows
}

/** "1042" or "#1042" in a search box is an order number. */
const orderNumberIn = (search: string | undefined): number | null =>
  search && /^#?\d{1,9}$/.test(search) ? Number(search.replace('#', '')) : null

export type ShipmentListFilter = {
  page: number
  perPage: number
  search?: string | undefined
  status?: string[] | undefined
  ndrStatus?: ShipmentNdrFilter[] | undefined
  provider?: string | undefined
  /** Booked at or after / before these moments (the filter panel's Booked). */
  bookedFrom?: string | undefined
  bookedTo?: string | undefined
  /** The order is cash on delivery, or paid up front. */
  paymentMethod?: 'cod' | 'prepaid' | undefined
}

/** A shipment's delivery-problem (NDR) states, as stored. */
export const SHIPMENT_NDR_STATUSES = ['none', 'pending', 'action_taken', 'resolved'] as const
export type ShipmentNdrFilter = (typeof SHIPMENT_NDR_STATUSES)[number]

/** The Shipments workspace's list: every shipment with its order number, filterable and searchable. */
export async function listShipments(
  tx: StoreTx,
  input: ShipmentListFilter,
  registry?: ShippingRegistry | undefined,
) {
  const orderNumber = orderNumberIn(input.search)
  const where = and(
    input.search
      ? or(
          ilike(shipment.waybill, `%${input.search}%`),
          ilike(order.email, `%${input.search}%`),
          ilike(address.name, `%${input.search}%`),
          ilike(address.pincode, `%${input.search}%`),
          orderNumber !== null ? eq(order.number, orderNumber) : undefined,
        )
      : undefined,
    input.status?.length ? inArray(shipment.status, input.status as never[]) : undefined,
    input.ndrStatus?.length ? inArray(shipment.ndrStatus, input.ndrStatus) : undefined,
    input.provider ? eq(shipment.provider, input.provider) : undefined,
    input.bookedFrom ? gte(shipment.createdAt, new Date(input.bookedFrom)) : undefined,
    input.bookedTo ? lt(shipment.createdAt, new Date(input.bookedTo)) : undefined,
    /* An order with no recorded method (imported history) is neither. */
    input.paymentMethod === 'cod'
      ? eq(order.paymentMethod, 'cod')
      : input.paymentMethod === 'prepaid'
        ? ne(order.paymentMethod, 'cod')
        : undefined,
  )
  const base = tx
    .select({
      id: shipment.id,
      orderId: shipment.orderId,
      orderNumber: order.number,
      placedAt: order.placedAt,
      email: order.email,
      shipToName: sql<string | null>`coalesce(${address.name}, ${customer.name})`,
      city: address.city,
      stateCode: address.stateCode,
      pincode: address.pincode,
      weightGrams: shipment.weightGrams,
      provider: shipment.provider,
      waybill: shipment.waybill,
      status: shipment.status,
      ndrStatus: shipment.ndrStatus,
      insured: shipment.insured,
      labelUrl: shipment.labelUrl,
      trackingUrl: shipment.trackingUrl,
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
    })
    .from(shipment)
    .innerJoin(order, eq(order.id, shipment.orderId))
    .leftJoin(address, eq(address.id, order.shippingAddressId))
    .leftJoin(customer, eq(customer.id, order.customerId))
    .where(where)
  const [countRow] = await tx
    .select({ total: count() })
    .from(shipment)
    .innerJoin(order, eq(order.id, shipment.orderId))
    .leftJoin(address, eq(address.id, order.shippingAddressId))
    .leftJoin(customer, eq(customer.id, order.customerId))
    .where(where)
  const rows = await base
    .orderBy(desc(shipment.createdAt))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  /* A label link that needs the courier's key (Delhivery, booked before the label route) is
     served by the admin's route instead; the courier app's own say on cancelling hides the
     row's Cancel for a courier that can't. */
  const items = rows.map((r) => ({
    ...r,
    labelUrl: shipmentLabelUrl(r),
    courierCancels: registry?.get(r.provider)?.capabilities.includes('cancel') ?? true,
  }))
  return { items, total: countRow?.total ?? 0 }
}

const gramsOrNull = (grams: number | string | null | undefined): number | null =>
  grams === null || grams === undefined ? null : Number(grams)

/** How many rows each Shipments tab holds, plus the two numbers the summary line uses. */
export async function shipmentCounts(tx: StoreTx, now = new Date()) {
  const today = startOfDay(now)
  const inGroup = (statuses: string[]) =>
    sql<number>`count(*) filter (where ${inArray(shipment.status, statuses as never[])})`
  const [row] = await tx
    .select({
      booked: inGroup(SHIPMENT_TAB_STATUSES.booked),
      inTransit: inGroup(SHIPMENT_TAB_STATUSES.inTransit),
      delivered: inGroup(SHIPMENT_TAB_STATUSES.delivered),
      rto: inGroup(SHIPMENT_TAB_STATUSES.rto),
      needsAttention: sql<number>`count(*) filter (where ${and(
        inArray(shipment.status, SHIPMENT_TAB_STATUSES.inTransit as never[]),
        eq(shipment.ndrStatus, 'pending'),
      )})`,
      bookedToday: sql<number>`count(*) filter (where ${gte(shipment.createdAt, today)})`,
    })
    .from(shipment)
  const [ready] = await tx
    .select({ total: count() })
    .from(order)
    .innerJoin(address, eq(address.id, order.shippingAddressId))
    .where(readyToShipWhere())
  return {
    toBook: ready?.total ?? 0,
    booked: Number(row?.booked ?? 0),
    inTransit: Number(row?.inTransit ?? 0),
    delivered: Number(row?.delivered ?? 0),
    rto: Number(row?.rto ?? 0),
    needsAttention: Number(row?.needsAttention ?? 0),
    bookedToday: Number(row?.bookedToday ?? 0),
  }
}

export type ReadyToShipFilter = { page: number; perPage: number; search?: string | undefined }

export type ReadyToShipRow = {
  orderId: string
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
}

/** Paid orders not yet shipped: fulfilment `unfulfilled`/`partially_fulfilled`, order not
 *  cancelled, and not tagged on hold. This is the Ready to ship tab's main list - the
 *  Shopify-style booking flow starts here instead of pasting order numbers. */
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
    // A held parcel (Hold fulfilment) keeps the order off the list until it is released.
    sql`not exists (select 1 from ${fulfillmentOrder} where ${fulfillmentOrder.orderId} = ${order.id} and ${fulfillmentOrder.heldAt} is not null and ${fulfillmentOrder.status} in ('open', 'on_hold'))`,
    // The older stand-in, kept for stores that mark holds with a tag.
    sql`not (${order.tags} && array['hold', 'on-hold']::text[])`,
  )

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
  const base = tx
    .select({
      orderId: order.id,
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
    .where(where)
  const [countRow] = await tx
    .select({ total: count() })
    .from(order)
    .innerJoin(address, eq(address.id, order.shippingAddressId))
    .leftJoin(customer, eq(customer.id, order.customerId))
    .where(where)
  const rows = await base
    .orderBy(desc(order.placedAt))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)

  const orderIds = rows.map((r) => r.orderId)
  const lineAgg =
    orderIds.length === 0
      ? []
      : await tx
          .select({
            orderId: orderLine.orderId,
            itemsCount: sql<number>`coalesce(sum(${orderLine.quantity}), 0)`,
            isPreorder: sql<boolean>`bool_or(${orderLine.preorder})`,
            weightGrams: sql<number | null>`sum(${orderLine.quantity} * ${variant.weightGrams})`,
          })
          .from(orderLine)
          .leftJoin(variant, eq(variant.id, orderLine.variantId))
          .where(inArray(orderLine.orderId, orderIds))
          .groupBy(orderLine.orderId)
  const byOrder = new Map(lineAgg.map((l) => [l.orderId, l]))

  return {
    items: rows.map((r) => ({
      ...r,
      itemsCount: Number(byOrder.get(r.orderId)?.itemsCount ?? 0),
      isPreorder: byOrder.get(r.orderId)?.isPreorder ?? false,
      weightGrams: gramsOrNull(byOrder.get(r.orderId)?.weightGrams),
    })),
    total: countRow?.total ?? 0,
  }
}

export async function bulkBookShipments(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  input: {
    orderIds: string[]
    weightGrams?: number | undefined
    dimensionsCm?: { length: number; width: number; height: number } | undefined
    insured?: boolean | undefined
    /** Merchant's per-row courier pick from the rate comparison table; orders not listed here
     *  book with the store's default rule (`settings.courierRule`). */
    courierOverrides?: Record<string, string> | undefined
    /** The service picked with each override (`CourierRateRow.serviceId`). */
    serviceOverrides?: Record<string, string> | undefined
  },
) {
  const settings = await loadShippingSettings(tx, storeId)
  const { providers } = resolveShippingProviders(registry, settings, secret)
  if (providers.length === 0) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Enable a courier first.' })
  }

  /* Single-courier stores skip rate comparison - there is nothing to choose between, unless
     the merchant picked one of its services (Surface or Express) per order. */
  const appOn = (await activeDeliveryConfig(tx, storeId)) !== null
  if (providers.length === 1 && !input.serviceOverrides && !appOn) {
    return bulkCreateShipments(
      { storeId, tx },
      providers[0] as (typeof providers)[0],
      input.orderIds,
      {
        weightGrams: input.weightGrams,
        dimensionsCm: input.dimensionsCm,
        insured: input.insured,
      },
    )
  }

  const contexts = await loadOrderShippingContexts(tx, input.orderIds)
  const found = new Set(contexts.map((c) => c.orderId))
  const results: Array<{
    orderId: string
    ok: boolean
    shipmentId?: string
    waybill?: string
    labelUrl?: string | null
    error?: string
    /** Delivery options app: the route the shopper paid for could not be booked; the merchant
     *  picks the courier for this order in Create shipment instead of a silent swap. */
    needsDecision?: boolean
  }> = []

  for (const o of contexts) {
    const overrideId = input.courierOverrides?.[o.orderId]
    const app = overrideId ? null : await bookingContext(tx, storeId, o.orderId)
    const route = app?.delivery?.route ?? null
    if (route) {
      // Delivery options app: book exactly the route the shopper paid for, through its own app.
      const label = `${route.serviceLabel} (${route.providerId})`
      const provider = providers.find((p) => p.id === route.providerId)
      if (!provider) {
        results.push({
          orderId: o.orderId,
          ok: false,
          needsDecision: true,
          error: `${label}: this courier app is no longer connected.`,
        })
        continue
      }
      try {
        const row = await createShipmentForOrder({ storeId, tx }, provider, o.orderId, {
          weightGrams: input.weightGrams,
          dimensionsCm: input.dimensionsCm,
          insured: input.insured ?? app?.delivery?.insured,
          serviceId: route.serviceId || undefined,
          serviceLabel: route.serviceLabel,
          carrier: route.carrier,
        })
        await noteShipmentBooked(tx, storeId, row.provider, o.orderId)
        results.push({ orderId: o.orderId, ok: true, shipmentId: row.id, waybill: row.waybill, labelUrl: row.labelUrl })
      } catch (err) {
        const reason = err instanceof CourierError ? describeCourierFailure(err) : err instanceof Error ? err.message : String(err)
        results.push({ orderId: o.orderId, ok: false, needsDecision: true, error: `${label}: ${reason}` })
      }
      continue
    }
    try {
      let provider = overrideId ? providers.find((p) => p.id === overrideId) : undefined
      if (!provider) {
        const query: RateQuery = {
          originPincode: settings.policy.originPincode,
          destinationPincode: o.pincode,
          weightGrams: input.weightGrams ?? ASSUMED_WEIGHT_GRAMS,
          declaredValuePaise: o.totalPaise,
          paymentMode: o.paymentMethod === 'cod' ? 'cod' : 'prepaid',
          destinationCountry: o.country,
          destinationCity: o.city,
        }
        const compared = await compareCourierRates(providers, query)
        /* Orders on backup or zone rates still follow the product route rules (Glasspads only
           with Delhivery): the store's courier rule picks among the routes they allow. */
        const allowed = app?.rules.length
          ? new Set(bookingPlan(compared, app, { insured: false }).allowedKeys)
          : null
        const options = allowed
          ? assignBadges(compared.filter((r) => allowed.has(r.optionKey)))
          : compared
        const ruleProviders = allowed
          ? providers.filter((p) => options.some((r) => r.providerId === p.id))
          : providers
        if (ruleProviders.length === 0) {
          throw new Error('No connected courier fits this order's product route rules.')
        }
        provider =
          chooseCourier(options, ruleProviders, settings.courierRule, { stateCode: o.stateCode }) ??
          ruleProviders[0]
      }
      const row = await createShipmentForOrder(
        { storeId, tx },
        provider as (typeof providers)[0],
        o.orderId,
        {
          weightGrams: input.weightGrams,
          dimensionsCm: input.dimensionsCm,
          insured: input.insured,
          // Only with the courier it was quoted for; a rule-picked courier books its default.
          serviceId: overrideId ? input.serviceOverrides?.[o.orderId] : undefined,
        },
      )
      await noteShipmentBooked(tx, storeId, row.provider, o.orderId)
      results.push({
        orderId: o.orderId,
        ok: true,
        shipmentId: row.id,
        waybill: row.waybill,
        labelUrl: row.labelUrl,
      })
    } catch (err) {
      results.push({
        orderId: o.orderId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  for (const id of input.orderIds) {
    if (!found.has(id))
      results.push({ orderId: id, ok: false, error: 'Order has no shipping address.' })
  }
  return results
}
