import {
  activeDeliveryConfig,
  bookingContext,
  bulkCreateShipments,
  chooseCourier,
  compareCourierRates,
  createShipmentForOrder,
  resolveShippingProviders,
  type ShippingRegistry,
  shipmentLabelUrl,
} from '@commerce/core'
import { SHIPMENT_TAB_STATUSES } from '@commerce/core/shipment-tabs'
import { startOfDay } from '@commerce/dates'
import type { StoreTx } from '@commerce/db'
import { address, customer, order, shipment } from '@commerce/db'
import { ASSUMED_WEIGHT_GRAMS, type RateQuery } from '@commerce/shipping'
import { ORPCError } from '@orpc/server'
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm'
import { bookSavedRoute, parcelsToBook, ruleAllowedRows } from './delivery-booking.service'
import { countReadyToShip, orderNumberIn } from './ready-to-ship.service'
import { bookingFor, type OrderBookingOverride } from './shipment-choices'
import { loadShippingSettings, noteShipmentBooked } from './shipping.service'

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

export type ShipmentListFilter = {
  page: number
  perPage: number
  search?: string | undefined
  status?: string[] | undefined
  /** True: only labels on a pickup (To be picked up); false: only those with none (Booked). */
  onPickup?: boolean | undefined
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
    input.onPickup === undefined
      ? undefined
      : input.onPickup
        ? isNotNull(shipment.pickupId)
        : isNull(shipment.pickupId),
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

/** How many rows each Shipments tab holds, plus the two numbers the summary line uses. */
export async function shipmentCounts(tx: StoreTx, now = new Date()) {
  const today = startOfDay(now)
  const inGroup = (statuses: string[]) =>
    sql<number>`count(*) filter (where ${inArray(shipment.status, statuses as never[])})`
  const [row] = await tx
    .select({
      booked: sql<number>`count(*) filter (where ${and(
        inArray(shipment.status, SHIPMENT_TAB_STATUSES.booked as never[]),
        isNull(shipment.pickupId),
      )})`,
      toPickUp: sql<number>`count(*) filter (where ${and(
        inArray(shipment.status, SHIPMENT_TAB_STATUSES.toPickUp as never[]),
        isNotNull(shipment.pickupId),
      )})`,
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
  return {
    toBook: await countReadyToShip(tx),
    booked: Number(row?.booked ?? 0),
    toPickUp: Number(row?.toPickUp ?? 0),
    inTransit: Number(row?.inTransit ?? 0),
    delivered: Number(row?.delivered ?? 0),
    rto: Number(row?.rto ?? 0),
    needsAttention: Number(row?.needsAttention ?? 0),
    bookedToday: Number(row?.bookedToday ?? 0),
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
    /** orderId -> the parcel (fulfilment order) Create shipment quoted for it. */
    parcelIds?: Record<string, string> | undefined
    /** orderId -> that order's own weight, box, payment mode and insurance (bulk Edit popup). */
    perOrder?: Record<string, OrderBookingOverride> | undefined
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
  const perOrder = input.perOrder ?? {}
  const plain = Object.keys(perOrder).length === 0
  if (providers.length === 1 && !input.serviceOverrides && !input.parcelIds && !appOn && plain) {
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
    /** The parcel booked, when the order was booked parcel by parcel. */
    fulfillmentOrderId?: string
    /** Delivery options app: the route the shopper paid for could not be booked; the merchant
     *  picks the courier for this order in Create shipment instead of a silent swap. */
    needsDecision?: boolean
  }> = []

  for (const o of contexts) {
    const overrideId = input.courierOverrides?.[o.orderId]
    // A split cart books parcel by parcel, each on the courier checkout quoted for it.
    for (const parcelId of await parcelsToBook(tx, o.orderId, input.parcelIds?.[o.orderId])) {
      const at = parcelId ? { fulfillmentOrderId: parcelId } : {}
      const app = overrideId ? null : await bookingContext(tx, storeId, o.orderId, parcelId)
      const own = bookingFor(input, perOrder[o.orderId])
      if (app?.delivery?.route) {
        const booked = await bookSavedRoute(tx, storeId, providers, o.orderId, app, {
          ...at,
          ...own,
        })
        results.push({ ...booked, ...at })
        continue
      }
      try {
        let provider = overrideId ? providers.find((p) => p.id === overrideId) : undefined
        if (!provider) {
          const query: RateQuery = {
            originPincode: settings.policy.originPincode,
            destinationPincode: o.pincode,
            weightGrams: own.weightGrams ?? ASSUMED_WEIGHT_GRAMS,
            declaredValuePaise: o.totalPaise,
            paymentMode: own.paymentMode ?? (o.paymentMethod === 'cod' ? 'cod' : 'prepaid'),
            destinationCountry: o.country,
            destinationCity: o.city,
          }
          const compared = await compareCourierRates(providers, query)
          const { options, providers: ruleProviders } = ruleAllowedRows(compared, providers, app)
          provider =
            chooseCourier(options, ruleProviders, settings.courierRule, {
              stateCode: o.stateCode,
            }) ?? ruleProviders[0]
        }
        const row = await createShipmentForOrder(
          { storeId, tx },
          provider as (typeof providers)[0],
          o.orderId,
          {
            ...at,
            ...own,
            // Only with the courier it was quoted for; a rule-picked courier books its default.
            serviceId: overrideId ? input.serviceOverrides?.[o.orderId] : undefined,
          },
        )
        await noteShipmentBooked(tx, storeId, row.provider, o.orderId)
        results.push({
          orderId: o.orderId,
          ...at,
          ok: true,
          shipmentId: row.id,
          waybill: row.waybill,
          labelUrl: row.labelUrl,
        })
      } catch (err) {
        results.push({
          orderId: o.orderId,
          ...at,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }
  for (const id of input.orderIds) {
    if (!found.has(id))
      results.push({ orderId: id, ok: false, error: 'Order has no shipping address.' })
  }
  return results
}
