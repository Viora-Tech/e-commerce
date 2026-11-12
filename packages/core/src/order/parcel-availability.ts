/** SOURCE OF TRUTH: linesAvailability, fillAvailability, availabilityOf, waitingFor
 * WHAT:  Whether each item of a parcel can ship now: how many units are on the shelf where the
 *        parcel leaves from, and for a pre-order still waiting, when it arrives (the pre-order
 *        campaign's ship date, else the date the line sold with); for a stock shortfall, when an
 *        open purchase order brings more.
 * WHY:   Partial shipments (Figma 916:10179, 918:10520, 918:10852): Create shipment ticks what
 *        can go, chips "Pre-order · arrives 22 Oct" / "1 of 2 in stock"; Shipments › To book says
 *        why a Part 2 waits; the order page says when the rest is ready.
 * WHERE: shipments.prepare (each draft line, `fillAvailability`), shipments.readyToShip (a
 *        row's waiting reason), orders.get (`partShipping`).
 */
import { dayKey } from '@commerce/dates'
import {
  inventoryLevel,
  order,
  orderLine,
  preorderCampaign,
  purchaseOrder,
  purchaseOrderLine,
  type StoreTx,
} from '@commerce/db'
import { and, eq, inArray, sql } from 'drizzle-orm'

/** One parcel line to judge: the units it holds and where the parcel leaves from. */
export type AvailabilityAsk = {
  orderLineId: string
  quantity: number
  /** The parcel's location; null judges the store's selling locations together. */
  locationId: string | null
}

export type LineAvailability = {
  /** Units on the shelf for this line, 0 up to the units it holds. */
  inStock: number
  /** A pre-order still waiting for its goods; null otherwise. `arrivesOn` is `YYYY-MM-DD`. */
  preorder: { arrivesOn: string | null } | null
  /** Short of stock: the day an open purchase order is due with more (`YYYY-MM-DD`). */
  restockOn: string | null
}

const DAY_MS = 86_400_000

/** The pure rule, for tests: shelf units clamp to the line; a pre-order waits until they cover it. */
export function availabilityOf(a: {
  quantity: number
  onHand: number
  preorder: boolean
  arrivesOn: string | null
  restockOn: string | null
}): LineAvailability {
  const inStock = Math.max(0, Math.min(a.quantity, Math.floor(a.onHand)))
  const short = inStock < a.quantity
  return {
    inStock,
    preorder: a.preorder && short ? { arrivesOn: a.arrivesOn } : null,
    restockOn: short && !a.preorder ? a.restockOn : null,
  }
}

/**
 * Why a parcel waits, from its lines: a pre-order (the latest arrival among them) before a stock
 * shortfall (the latest restock). Null when every unit is on the shelf.
 */
export function waitingFor(
  lines: readonly LineAvailability[],
  quantities: readonly number[],
): { kind: 'preorder' | 'stock'; on: string | null } | null {
  const short = lines.filter((l, i) => l.inStock < (quantities[i] ?? 0))
  if (short.length === 0) return null
  const latest = (dates: Array<string | null>) =>
    dates.includes(null) ? null : ((dates as string[]).sort().at(-1) ?? null)
  const pre = short.filter((l) => l.preorder)
  if (pre.length > 0)
    return { kind: 'preorder', on: latest(pre.map((l) => l.preorder?.arrivesOn ?? null)) }
  return { kind: 'stock', on: latest(short.map((l) => l.restockOn)) }
}

/** The arrival date of a pre-order line: its active campaign's, else the date it sold with. */
function arrivalOf(r: {
  placedAt: Date
  lineShipDate: Date | null
  campaignStatus: string | null
  campaignShipDate: Date | null
  campaignShipsInDays: number | null
}): string | null {
  if (r.campaignStatus === 'active') {
    if (r.campaignShipDate) return dayKey(r.campaignShipDate)
    if (r.campaignShipsInDays !== null) {
      return dayKey(new Date(r.placedAt.getTime() + r.campaignShipsInDays * DAY_MS))
    }
  }
  return r.lineShipDate ? dayKey(r.lineShipDate) : null
}

/** Each ask's availability, in the order asked. Three reads for any number of lines. */
export async function linesAvailability(
  tx: StoreTx,
  asks: readonly AvailabilityAsk[],
): Promise<LineAvailability[]> {
  if (asks.length === 0) return []
  const lineIds = [...new Set(asks.map((a) => a.orderLineId))]
  const lines = await tx
    .select({
      id: orderLine.id,
      variantId: orderLine.variantId,
      preorder: orderLine.preorder,
      lineShipDate: orderLine.preorderShipDate,
      placedAt: order.placedAt,
      campaignStatus: preorderCampaign.status,
      campaignShipDate: preorderCampaign.shipDate,
      campaignShipsInDays: preorderCampaign.shipsInDays,
    })
    .from(orderLine)
    .innerJoin(order, eq(order.id, orderLine.orderId))
    .leftJoin(preorderCampaign, eq(preorderCampaign.id, orderLine.preorderCampaignId))
    .where(inArray(orderLine.id, lineIds))
  const byLine = new Map(lines.map((l) => [l.id, l]))
  const variantIds = [...new Set(lines.flatMap((l) => (l.variantId ? [l.variantId] : [])))]
  const levels =
    variantIds.length === 0
      ? []
      : await tx
          .select({
            variantId: inventoryLevel.variantId,
            locationId: inventoryLevel.locationId,
            onHand: inventoryLevel.onHand,
            fulfilsOnline: inventoryLevel.fulfilsOnline,
          })
          .from(inventoryLevel)
          .where(inArray(inventoryLevel.variantId, variantIds))
  // Open purchase orders still owed units of these variants: the earliest due date per place.
  const restocks =
    variantIds.length === 0
      ? []
      : await tx
          .select({
            variantId: purchaseOrderLine.variantId,
            locationId: purchaseOrder.locationId,
            expectedAt: purchaseOrder.expectedAt,
          })
          .from(purchaseOrderLine)
          .innerJoin(purchaseOrder, eq(purchaseOrder.id, purchaseOrderLine.purchaseOrderId))
          .where(
            and(
              inArray(purchaseOrderLine.variantId, variantIds),
              inArray(purchaseOrder.status, ['ordered', 'partially_received']),
              sql`${purchaseOrder.expectedAt} is not null`,
              sql`${purchaseOrderLine.quantity} > ${purchaseOrderLine.received} + ${purchaseOrderLine.rejected}`,
            ),
          )

  return asks.map((ask) => {
    const line = byLine.get(ask.orderLineId)
    if (!line?.variantId) {
      // A custom item with no variant has no stock count: it ships when staff say so.
      return { inStock: ask.quantity, preorder: null, restockOn: null }
    }
    const here = (r: { variantId: string; locationId: string | null }) =>
      r.variantId === line.variantId && (ask.locationId === null || r.locationId === ask.locationId)
    const onHand = levels
      .filter((l) => here(l) && (ask.locationId !== null || l.fulfilsOnline))
      .reduce((n, l) => n + l.onHand, 0)
    const due = restocks
      .filter(here)
      .flatMap((r) => (r.expectedAt ? [dayKey(r.expectedAt)] : []))
      .sort()[0]
    return availabilityOf({
      quantity: ask.quantity,
      onHand,
      preorder: line.preorder,
      arrivesOn: line.preorder ? arrivalOf(line) : null,
      restockOn: due ?? null,
    })
  })
}

/** Sets each draft row's `availability` in place: rows of any parcels, each with its location. */
export async function fillAvailability(
  tx: StoreTx,
  rows: ReadonlyArray<{
    row: { id: string; quantity: number; availability: LineAvailability }
    locationId: string | null
  }>,
): Promise<void> {
  const found = await linesAvailability(
    tx,
    rows.map(({ row, locationId }) => ({
      orderLineId: row.id,
      quantity: row.quantity,
      locationId,
    })),
  )
  rows.forEach(({ row }, i) => {
    row.availability = found[i] ?? row.availability
  })
}
