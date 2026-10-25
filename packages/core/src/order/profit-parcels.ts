/** SOURCE OF TRUTH: orderParcelCosts, deliveryRatesFor, packingSnapshot
 * WHAT:  Loads each order's parcels, consignments, boxes and destination, plus the store's
 *        recent courier charges, and prices packing and delivery per parcel
 *        (order/profit-estimates.ts PARCEL_COSTS); and the packing snapshot a consignment
 *        packed by hand keeps.
 * WHY:   profitFacts (order/profit-service.ts) reads hundreds of orders at once for the Profit
 *        reports; this keeps that to a fixed handful of queries.
 * WHERE: order/profit-service.ts profitFacts; order/fulfil.ts.
 */
import {
  address,
  fulfillmentOrder,
  fulfillmentOrderLine,
  order,
  type StoreTx,
  shipment,
  store,
  variant,
} from '@commerce/db'
import { and, eq, gte, inArray, isNotNull, ne, sql } from 'drizzle-orm'
import { parcelBoxPreset } from '../shipping/parcel'
import { parseShippingSettings } from '../shipping/settings'
import { parseProfitCosts } from './profit'
import {
  buildDeliveryRates,
  DELIVERY_LOOKBACK_DAYS,
  type DeliveryRates,
  type ParcelCost,
  type ParcelShipment,
  parcelCost,
} from './profit-estimates'

const DAY_MS = 86_400_000

/** The highest real courier charge per courier and state over the last 60 days (RLS: this store). */
async function deliveryRatesFor(tx: StoreTx, now = new Date()): Promise<DeliveryRates> {
  const since = new Date(now.getTime() - DELIVERY_LOOKBACK_DAYS * DAY_MS)
  const rows = await tx
    .select({
      provider: shipment.provider,
      stateCode: address.stateCode,
      chargePaise: sql<number>`max(${shipment.courierChargePaise})::int`,
    })
    .from(shipment)
    .innerJoin(order, eq(order.id, shipment.orderId))
    .innerJoin(address, eq(address.id, order.shippingAddressId))
    .where(
      and(
        isNotNull(shipment.courierChargePaise),
        ne(shipment.status, 'cancelled'),
        gte(shipment.createdAt, since),
      ),
    )
    .groupBy(shipment.provider, address.stateCode)
  return buildDeliveryRates(rows)
}

type OrderRow = { id: string; status: string; shippingAddressId: string | null }
type LineRow = {
  id: string
  orderId: string
  quantity: number
  giftCard: boolean
  boxPresetId: string | null
}

/** Each order's parcel costs, keyed by order id (orders with none map to an empty list). */
export async function orderParcelCosts(
  tx: StoreTx,
  orders: readonly OrderRow[],
  lines: readonly LineRow[],
): Promise<Map<string, ParcelCost[]>> {
  const out = new Map<string, ParcelCost[]>()
  if (orders.length === 0) return out
  const ids = orders.map((o) => o.id)
  const addressIds = orders.flatMap((o) => (o.shippingAddressId ? [o.shippingAddressId] : []))
  const states = addressIds.length
    ? await tx
        .select({ id: address.id, stateCode: address.stateCode })
        .from(address)
        .where(inArray(address.id, addressIds))
    : []
  const parcels = await tx
    .select({
      id: fulfillmentOrder.id,
      orderId: fulfillmentOrder.orderId,
      status: fulfillmentOrder.status,
    })
    .from(fulfillmentOrder)
    .where(inArray(fulfillmentOrder.orderId, ids))
  const parcelLines = parcels.length
    ? await tx
        .select({
          fulfillmentOrderId: fulfillmentOrderLine.fulfillmentOrderId,
          orderLineId: fulfillmentOrderLine.orderLineId,
          quantity: fulfillmentOrderLine.quantity,
        })
        .from(fulfillmentOrderLine)
        .where(
          inArray(
            fulfillmentOrderLine.fulfillmentOrderId,
            parcels.map((p) => p.id),
          ),
        )
    : []
  const consignments = await tx
    .select({
      orderId: shipment.orderId,
      fulfillmentOrderId: shipment.fulfillmentOrderId,
      provider: shipment.provider,
      status: shipment.status,
      courierChargePaise: shipment.courierChargePaise,
      packingCostPaise: shipment.packingCostPaise,
      createdAt: shipment.createdAt,
    })
    .from(shipment)
    .where(inArray(shipment.orderId, ids))
  // The store's own row (row-level security shows only it).
  const [s] = await tx.select({ apps: store.apps, shipping: store.shipping }).from(store).limit(1)
  const settings = parseShippingSettings(s?.shipping)
  const costs = parseProfitCosts(s?.apps)
  const rates = await deliveryRatesFor(tx)
  const stateOf = new Map(states.map((a) => [a.id, a.stateCode]))
  const lineById = new Map(lines.map((l) => [l.id, l]))
  const boxCost = (picked: { quantity: number; boxPresetId: string | null }[]) =>
    parcelBoxPreset(picked, settings.boxPresets)?.costPaise ?? null
  const asShipment = (c: (typeof consignments)[number]): ParcelShipment => ({
    provider: c.provider,
    cancelled: c.status === 'cancelled',
    courierChargePaise: c.courierChargePaise,
    packingCostPaise: c.packingCostPaise,
  })
  const byAge = (a: { createdAt: Date }, b: { createdAt: Date }) =>
    a.createdAt.getTime() - b.createdAt.getTime()

  for (const o of orders) {
    const ctx = {
      orderCancelled: o.status === 'cancelled',
      shipsToAddress: o.shippingAddressId !== null,
      stateCode: o.shippingAddressId ? (stateOf.get(o.shippingAddressId) ?? null) : null,
      defaultCourier: settings.enabled[0] ?? null,
      rates,
      defaultDeliveryPaise: costs.defaultDeliveryPaise,
    }
    const own = lines.filter((l) => l.orderId === o.id)
    const shipped = consignments.filter((c) => c.orderId === o.id).sort(byAge)
    const mine = parcels.filter((p) => p.orderId === o.id)
    const result: ParcelCost[] = []
    const push = (cost: ParcelCost | null) => {
      if (cost) result.push(cost)
    }
    if (mine.length === 0) {
      // An order older than parcels ships as one.
      const picked = own.filter((l) => !l.giftCard)
      push(
        parcelCost(
          {
            shippable: picked.length > 0,
            cancelled: false,
            boxCostPaise: boxCost(picked),
            shipments: shipped.map(asShipment),
          },
          ctx,
        ),
      )
    } else {
      const loose = shipped.filter((x) => x.fulfillmentOrderId === null)
      for (const p of mine) {
        const booked = shipped.filter((c) => c.fulfillmentOrderId === p.id)
        // A consignment that names no parcel (packed by hand, or booked before parcels) covers
        // the parcels with none of their own.
        if (loose.length > 0 && booked.length === 0) continue
        const picked = parcelLines
          .filter((pl) => pl.fulfillmentOrderId === p.id)
          .flatMap((pl) => {
            const line = lineById.get(pl.orderLineId)
            return line && !line.giftCard
              ? [{ quantity: pl.quantity, boxPresetId: line.boxPresetId }]
              : []
          })
        push(
          parcelCost(
            {
              shippable: picked.length > 0,
              cancelled: p.status === 'cancelled',
              boxCostPaise: boxCost(picked),
              shipments: booked.map(asShipment),
            },
            ctx,
          ),
        )
      }
      // Consignments booked for no single parcel (packed by hand across parcels) price alone.
      const orderBox = boxCost(own.filter((l) => !l.giftCard))
      for (const c of loose) {
        push(
          parcelCost(
            {
              shippable: true,
              cancelled: false,
              boxCostPaise: orderBox,
              shipments: [asShipment(c)],
            },
            ctx,
          ),
        )
      }
    }
    out.set(o.id, result)
  }
  return out
}

/**
 * The packing snapshot for a consignment packed by hand: the box its products pick (else the
 * store's main box) and that box's cost now (PARCEL_COSTS).
 */
export async function packingSnapshot(
  tx: StoreTx,
  picks: readonly { variantId: string; quantity: number }[],
): Promise<{ packingCostPaise: number | null; boxPresetId: string | null }> {
  const variantIds = [...new Set(picks.map((p) => p.variantId))]
  const boxes = variantIds.length
    ? await tx
        .select({ id: variant.id, boxPresetId: variant.boxPresetId })
        .from(variant)
        .where(inArray(variant.id, variantIds))
    : []
  const [s] = await tx.select({ shipping: store.shipping }).from(store).limit(1)
  const boxOf = new Map(boxes.map((b) => [b.id, b.boxPresetId]))
  const box = parcelBoxPreset(
    picks.map((p) => ({ quantity: p.quantity, boxPresetId: boxOf.get(p.variantId) ?? null })),
    parseShippingSettings(s?.shipping).boxPresets,
  )
  return { packingCostPaise: box?.costPaise ?? null, boxPresetId: box?.id ?? null }
}
