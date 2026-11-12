import {
  type BoxPreset,
  bookingContext,
  bookingPlan,
  type CourierRateRow,
  compareCourierRates,
  datedCourierRows,
  defaultBoxPreset,
  effectiveWeightGrams,
  fillAvailability,
  heldParcels,
  type LineAvailability,
  orderParcelsView,
  parcelBoxPreset,
  parcelInsuranceFacts,
  quoteDeclaredValuePaise,
  rebookableParcels,
  resolveParcelPackage,
  resolveParcelWeightGrams,
  resolveShippingProviders,
  rowCover,
  rowInsurance,
  type ShippingRegistry,
  shipFromFor,
  toShippingPolicy,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { address, customer, location, order, orderLine, store, variant } from '@commerce/db'
import { ASSUMED_WEIGHT_GRAMS } from '@commerce/shipping'
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { withThumbnails } from './order-detail.service'
import { type DeliveryChoice, deliveryChoiceOf } from './shipment-choices'
import { loadShippingSettings } from './shipping.service'

/**
 * The Create shipment flow (order page, Orders → Shipments, book by order number, bulk): what
 * step 1 pre-fills (`prepareShipments`) and what step 2 compares (`quoteShipments`). Booking
 * itself stays on `orders.createShipment` (one parcel) and `shipments.bulkBook` (several
 * orders), which take the courier the merchant picked here.
 */

export type DimensionsCm = { length: number; width: number; height: number }

/** Where a courier can collect from: a location with courier pickup on, or (id null)
 *  Settings › Shipping's address. */
export type PickupPlace = {
  id: string | null
  name: string
  city: string | null
  pincode: string
  /** The rest of the address, for the Create shipment route card. */
  line1: string | null
  line2: string | null
  stateCode: string | null
  phone: string | null
}

export type DraftParcel = {
  /** The fulfilment order; null when the order ships whole (older orders without parcels). */
  id: string | null
  position: number
  locationName: string | null
  /** The units still to send, per order line. */
  lines: Array<{
    id: string
    title: string
    quantity: number
    /** For telling the items apart while packing. */
    imageUrl: string | null
    sku: string | null
    unitPricePaise: number
    /** One unit's weight from its variant; null when the product has none. */
    weightGrams: number | null
    /** On the shelf now, or a pre-order still waiting (Figma 916:10179's chips and ticks). */
    availability: LineAvailability
  }>
  /** Declared value: the parcel's share of the order, or the order total when it ships whole. */
  valuePaise: number
  /** The products' weights (500 g for one with none) plus the packing of the box it goes in. */
  weightGrams: number
  /** The products' own box when every line agrees on one; null uses the default box. */
  dimensionsCm: DimensionsCm | null
  /** Where it leaves from by default: the parcel's location when it has courier pickup on. */
  pickupLocationId: string | null
  /** The store's box it packs into (`parcelBoxPreset`), for the bulk table; null for none. */
  boxName: string | null
}

export type DraftOrder = {
  orderId: string
  orderNumber: number
  customerName: string | null
  city: string | null
  pincode: string | null
  /** The rest of the ship-to address, for the Create shipment route card. */
  line1: string | null
  line2: string | null
  stateCode: string | null
  phone: string | null
  paymentStatus: string
  fulfillmentStatus: string
  paymentMode: 'cod' | 'prepaid'
  totalPaise: number
  /** Why this order can't be booked here, if it can't. */
  blocked: 'no_address' | 'closed' | 'nothing_to_ship' | 'on_hold' | null
  parcels: DraftParcel[]
  /** Units on the order that need shipping, for "Ships 1 of 2 items" on a part parcel. */
  unitsOrdered: number
  /** The shopper's delivery choice at checkout; null when the order has none saved. */
  deliveryChoice: DeliveryChoice | null
}

export type ShipmentDraft = {
  couriers: Array<{ id: string; label: string; hasRates: boolean; hasPickup: boolean }>
  boxes: BoxPreset[]
  defaultBoxId: string | null
  pickupPlaces: PickupPlace[]
  orders: DraftOrder[]
  /** Settings › Shipping: shipping insurance starts switched on in Create shipment. */
  insureByDefault: boolean
}

const CLOSED_STATUSES = new Set(['cancelled', 'draft'])
const OPEN_PARCEL = new Set(['open', 'on_hold'])

function lineTitle(title: string | null, variantTitle: string | null): string {
  const v = variantTitle?.trim()
  return [title?.trim() || '—', v && v !== 'Default' && v !== 'Default Title' ? v : null]
    .filter(Boolean)
    .join(' / ')
}

const toDims = (
  p: { lengthCm: number; widthCm: number; heightCm: number } | null,
): DimensionsCm | null => (p ? { length: p.lengthCm, width: p.widthCm, height: p.heightCm } : null)

/** Step 1's pre-fill for each order: its parcels (what is in each, from where), weight and
 *  box from the products, payment mode; plus the store's couriers, boxes and pickup places. */
export async function prepareShipments(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  orderIds: string[],
): Promise<ShipmentDraft> {
  const settings = await loadShippingSettings(tx, storeId)
  const { providers } = resolveShippingProviders(registry, settings, secret)
  const [s] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
  const storeName = s?.name ?? ''
  const box = defaultBoxPreset(settings)

  const places = await tx
    .select({
      id: location.id,
      name: location.name,
      city: location.city,
      pincode: location.pincode,
      line1: location.line1,
      line2: location.line2,
      stateCode: location.stateCode,
      phone: location.phone,
    })
    .from(location)
    .where(isNotNull(location.courierPickup))
    .orderBy(location.name)
  // The same address a booking from Settings › Shipping sends (Store details when it has no street).
  const storeFrom = (
    await shipFromFor(tx, { taxOrigin: null, storeAddress: true, settings, storeName })
  ).address
  const pickupPlaces: PickupPlace[] = [
    {
      id: null,
      name: storeFrom.name,
      city: storeFrom.city || null,
      pincode: storeFrom.pincode,
      line1: storeFrom.line1 || null,
      line2: storeFrom.line2 || null,
      stateCode: storeFrom.state || null,
      phone: storeFrom.phone || null,
    },
    ...places.flatMap((p) => (p.pincode ? [{ ...p, pincode: p.pincode }] : [])),
  ]

  const orders =
    orderIds.length === 0
      ? []
      : await tx
          .select({
            id: order.id,
            number: order.number,
            status: order.status,
            paymentMethod: order.paymentMethod,
            totalPaise: order.totalPaise,
            taxOrigin: order.taxOrigin,
            hasAddress: isNotNull(order.shippingAddressId),
            customerName: sql<string | null>`coalesce(${address.name}, ${customer.name})`,
            city: address.city,
            pincode: address.pincode,
            line1: address.line1,
            line2: address.line2,
            stateCode: address.stateCode,
            phone: address.phone,
            paymentStatus: order.paymentStatus,
            fulfillmentStatus: order.fulfillmentStatus,
            shipping: order.shipping,
          })
          .from(order)
          .leftJoin(address, eq(address.id, order.shippingAddressId))
          .leftJoin(customer, eq(customer.id, order.customerId))
          .where(inArray(order.id, orderIds))
  const orderLines =
    orders.length === 0
      ? []
      : await tx
          .select({
            id: orderLine.id,
            orderId: orderLine.orderId,
            variantId: orderLine.variantId,
            title: orderLine.title,
            variantTitle: orderLine.variantTitle,
            quantity: orderLine.quantity,
            fulfilledQuantity: orderLine.fulfilledQuantity,
            unitPricePaise: orderLine.unitPricePaise,
            giftCard: orderLine.giftCard,
            variantWeightGrams: variant.weightGrams,
            boxPresetId: variant.boxPresetId,
            packageLengthCm: variant.packageLengthCm,
            packageWidthCm: variant.packageWidthCm,
            packageHeightCm: variant.packageHeightCm,
          })
          .from(orderLine)
          .leftJoin(variant, eq(variant.id, orderLine.variantId))
          .where(
            and(
              inArray(
                orderLine.orderId,
                orders.map((o) => o.id),
              ),
              // Lines that need no shipping never go in a parcel; one holding only those is skipped.
              eq(orderLine.requiresShipping, true),
            ),
          )
  const lines = await withThumbnails(tx, orderLines)

  type Line = (typeof lines)[number]
  /* Every parcel line, with where it leaves from: availability is read in one go at the end. */
  const asked: Array<{ row: DraftParcel['lines'][number]; locationId: string | null }> = []
  const draftParcel = (
    base: Pick<DraftParcel, 'id' | 'position' | 'locationName' | 'pickupLocationId'>,
    picked: Array<{ line: Line; quantity: number }>,
    valuePaise: number | null,
    locationId: string | null,
  ): DraftParcel => {
    const weighed = picked.map((p) => ({ ...p.line, quantity: p.quantity }))
    const dims = resolveParcelPackage(weighed, settings.boxPresets)
    return {
      ...base,
      lines: picked.map((p) => {
        const row: DraftParcel['lines'][number] = {
          id: p.line.id,
          title: lineTitle(p.line.title, p.line.variantTitle),
          quantity: p.quantity,
          imageUrl: p.line.imageUrl,
          sku: p.line.sku,
          unitPricePaise: p.line.unitPricePaise,
          weightGrams: p.line.variantWeightGrams,
          availability: { inStock: p.quantity, preorder: null, restockOn: null },
        }
        asked.push({ row, locationId })
        return row
      }),
      valuePaise:
        valuePaise ?? picked.reduce((sum, p) => sum + p.line.unitPricePaise * p.quantity, 0),
      weightGrams: effectiveWeightGrams(
        // Products plus the packing of the box this parcel goes in.
        resolveParcelWeightGrams(
          weighed,
          parcelBoxPreset(weighed, settings.boxPresets)?.weightGrams ?? 0,
        ),
        dims,
      ),
      dimensionsCm: toDims(dims),
      boxName: parcelBoxPreset(weighed, settings.boxPresets)?.name ?? null,
    }
  }

  const drafts: DraftOrder[] = []
  for (const o of orders) {
    const own = lines.filter((l) => l.orderId === o.id)
    const byLine = new Map(own.map((l) => [l.id, l]))
    const parcels: DraftParcel[] = []
    const all = await orderParcelsView(tx, o.id)
    // A held parcel (Hold fulfilment) waits for its release; booking it is refused anyway.
    const held = new Set((await heldParcels(tx, o.id)).map((p) => p.id))
    /* A parcel whose label was cancelled is packed but not on its way: it books again with
       the units in its box (`rebookableParcels`). */
    const rebook = await rebookableParcels(tx, o.id)
    const views = all.filter(
      (p) =>
        (OPEN_PARCEL.has(p.status) || (p.status !== 'cancelled' && rebook.has(p.id))) &&
        !held.has(p.id),
    )
    // A parcel that is the whole order is worth the order; one of several, its own share.
    const live = all.filter((p) => p.status !== 'cancelled')
    for (const view of views) {
      const unpacked = view.lines.flatMap((l) => {
        const line = byLine.get(l.orderLineId)
        const quantity = l.quantity - l.fulfilledQuantity
        return line && quantity > 0 ? [{ line, quantity }] : []
      })
      const picked =
        unpacked.length > 0 || !rebook.has(view.id)
          ? unpacked
          : view.lines.flatMap((l) => {
              const line = byLine.get(l.orderLineId)
              return line && l.fulfilledQuantity > 0
                ? [{ line, quantity: l.fulfilledQuantity }]
                : []
            })
      if (picked.length === 0) continue
      const from = await shipFromFor(tx, {
        taxOrigin: o.taxOrigin,
        locationId: view.locationId,
        settings,
        storeName,
      })
      parcels.push(
        draftParcel(
          {
            id: view.id,
            position: view.position,
            locationName: view.locationName,
            pickupLocationId: from.locationId,
          },
          picked,
          live.length === 1 ? o.totalPaise : view.totalPaise,
          view.locationId,
        ),
      )
    }
    // An order older than parcels ships whole: every unit still unpacked.
    if (all.length === 0) {
      const unpacked = own.flatMap((line) => {
        const quantity = line.quantity - line.fulfilledQuantity
        return quantity > 0 && !line.giftCard ? [{ line, quantity }] : []
      })
      const picked =
        unpacked.length > 0 || !rebook.has(null)
          ? unpacked
          : own.flatMap((line) =>
              line.fulfilledQuantity > 0 && !line.giftCard
                ? [{ line, quantity: line.fulfilledQuantity }]
                : [],
            )
      if (picked.length > 0) {
        const from = await shipFromFor(tx, { taxOrigin: o.taxOrigin, settings, storeName })
        parcels.push(
          draftParcel(
            { id: null, position: 1, locationName: null, pickupLocationId: from.locationId },
            picked,
            o.totalPaise,
            null,
          ),
        )
      }
    }
    drafts.push({
      orderId: o.id,
      orderNumber: o.number,
      customerName: o.customerName,
      city: o.city,
      pincode: o.pincode,
      line1: o.line1,
      line2: o.line2,
      stateCode: o.stateCode,
      phone: o.phone,
      paymentStatus: o.paymentStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      paymentMode: o.paymentMethod === 'cod' ? 'cod' : 'prepaid',
      totalPaise: o.totalPaise,
      blocked: CLOSED_STATUSES.has(o.status)
        ? 'closed'
        : !o.hasAddress
          ? 'no_address'
          : parcels.length === 0
            ? held.size > 0
              ? 'on_hold'
              : 'nothing_to_ship'
            : null,
      parcels,
      unitsOrdered: own.reduce((n, l) => n + (l.giftCard ? 0 : l.quantity), 0),
      deliveryChoice: deliveryChoiceOf(o.shipping),
    })
  }
  // In the order the caller asked for (the rows the merchant ticked).
  drafts.sort((a, b) => orderIds.indexOf(a.orderId) - orderIds.indexOf(b.orderId))

  await fillAvailability(tx, asked)

  return {
    couriers: providers.map((p) => ({
      id: p.id,
      label: p.label,
      hasRates: Boolean(p.quoteRate),
      hasPickup: Boolean(p.schedulePickup),
    })),
    boxes: settings.boxPresets,
    defaultBoxId: box?.id ?? null,
    pickupPlaces,
    orders: drafts,
    insureByDefault: settings.policy.insureByDefault,
  }
}

export type QuoteRequest = {
  orderId: string
  fulfillmentOrderId?: string | null | undefined
  /** As picked in step 1: a location id, null for Settings › Shipping, omitted for automatic. */
  pickupLocationId?: string | null | undefined
  weightGrams?: number | undefined
  dimensionsCm?: DimensionsCm | undefined
  paymentMode?: 'cod' | 'prepaid' | undefined
  declaredValuePaise?: number | undefined
}

export type QuoteResult = {
  orderId: string
  fulfillmentOrderId: string | null
  /** The weight couriers bill: the heavier of actual and volumetric. */
  chargedWeightGrams: number
  originPincode: string
  options: CourierRateRow[]
  /**
   * Delivery options app: the option and route the shopper paid for. Its row is marked
   * `chosenAtCheckout`; when it cannot be booked, `problem` says why and `fallbackKey` names
   * the next route that still fits (product rules, insurance, COD, speed). Null otherwise.
   */
  checkout: {
    optionName: string
    carrier: string
    serviceLabel: string
    providerId: string
    insured: boolean
    /** What the shopper paid for shipping. */
    chargedPaise: number
    chosenKey: string | null
    problem: string | null
    fallbackKey: string | null
  } | null
}

/**
 * Step 2: every connected courier's price, delivery date and COD support for each parcel, from
 * the pickup place picked in step 1 to the order's address. A courier that fails or says no
 * gets its own row with the reason, never blanking the others (`compareCourierRates`).
 */
export async function quoteShipments(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  requests: QuoteRequest[],
  now = new Date(),
): Promise<QuoteResult[]> {
  const settings = await loadShippingSettings(tx, storeId)
  const { providers } = resolveShippingProviders(registry, settings, secret)
  if (requests.length === 0) return []
  const [s] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
  const rows = await tx
    .select({
      id: order.id,
      totalPaise: order.totalPaise,
      paymentMethod: order.paymentMethod,
      taxOrigin: order.taxOrigin,
      pincode: address.pincode,
      country: address.country,
      city: address.city,
      shippingPaise: order.shippingPaise,
    })
    .from(order)
    .innerJoin(address, eq(address.id, order.shippingAddressId))
    .where(
      inArray(
        order.id,
        requests.map((r) => r.orderId),
      ),
    )
  const byId = new Map(rows.map((r) => [r.id, r]))
  const policy = toShippingPolicy(settings)

  const results = await Promise.all(
    requests.map(async (r): Promise<QuoteResult | null> => {
      const o = byId.get(r.orderId)
      if (!o) return null
      const from = await shipFromFor(tx, {
        taxOrigin: o.taxOrigin,
        locationId: r.pickupLocationId ?? undefined,
        storeAddress: r.pickupLocationId === null,
        settings,
        storeName: s?.name ?? '',
      })
      const dims = r.dimensionsCm
        ? {
            lengthCm: r.dimensionsCm.length,
            widthCm: r.dimensionsCm.width,
            heightCm: r.dimensionsCm.height,
          }
        : null
      const chargedWeightGrams = effectiveWeightGrams(r.weightGrams ?? ASSUMED_WEIGHT_GRAMS, dims)
      const options = await compareCourierRates(providers, {
        originPincode: from.address.pincode,
        destinationPincode: o.pincode,
        weightGrams: chargedWeightGrams,
        declaredValuePaise: r.declaredValuePaise ?? o.totalPaise,
        paymentMode: r.paymentMode ?? (o.paymentMethod === 'cod' ? 'cod' : 'prepaid'),
        destinationCountry: o.country,
        destinationCity: o.city,
        ...(r.dimensionsCm ? { dimensionsCm: r.dimensionsCm } : {}),
      })
      /* What the drawer's Shipping insurance switch adds to each row: Delhivery Protect for this
         parcel's products, the route's own rate, or nothing known (couriers quote none). */
      const facts = await parcelInsuranceFacts(tx, storeId, o.id, r.fulfillmentOrderId)
      // Priced on exactly the value booking declares to the courier.
      const value = await quoteDeclaredValuePaise(
        tx,
        o.id,
        r.fulfillmentOrderId,
        o.totalPaise,
        r.declaredValuePaise ?? o.totalPaise,
      )
      const dated = datedCourierRows(options, policy, now).map((row) => ({
        ...row,
        insurance: row.problem ? null : rowInsurance(row, facts, value),
        cover: rowCover(row, facts, value),
      }))
      const app = await bookingContext(tx, storeId, o.id, r.fulfillmentOrderId)
      const saved = app?.delivery
      if (!app || !saved?.route) {
        return {
          orderId: o.id,
          fulfillmentOrderId: r.fulfillmentOrderId ?? null,
          chargedWeightGrams,
          originPincode: from.address.pincode,
          options: dated,
          checkout: null,
        }
      }
      const plan = bookingPlan(dated, app, { insured: saved.insured })
      return {
        orderId: o.id,
        fulfillmentOrderId: r.fulfillmentOrderId ?? null,
        chargedWeightGrams,
        originPincode: from.address.pincode,
        options: dated.map((row) =>
          row.optionKey === plan.chosenKey ? { ...row, chosenAtCheckout: true } : row,
        ),
        checkout: {
          optionName: saved.optionName,
          carrier: saved.route.carrier,
          serviceLabel: saved.route.serviceLabel,
          providerId: saved.route.providerId,
          insured: saved.insured,
          chargedPaise: o.shippingPaise,
          chosenKey: plan.chosenKey,
          problem: plan.chosenProblem,
          fallbackKey: plan.fallbackKey,
        },
      }
    }),
  )
  return results.filter((r): r is QuoteResult => r !== null)
}
