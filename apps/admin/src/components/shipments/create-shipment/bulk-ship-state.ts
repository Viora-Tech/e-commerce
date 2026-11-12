import type { CourierRateRow } from '@commerce/core'
import {
  type BulkMode,
  type BulkSkip,
  bulkOrders,
  type Dimensions,
  type DraftOrder,
  type DraftParcel,
  isBookable,
  type ParcelQuote,
  type ShipmentDraft,
} from './flow-state'
import { insuredRows } from './insured-rows'

/**
 * The bulk ship drawer's pure parts (Figma 908:8804): one line per ticked order with its
 * package, payment, courier under the rule (or the merchant's own pick), its charge and what
 * stops it from booking; the footer's totals; what `shipments.bulkBook` is sent; and the
 * result's pickups, one per courier (Figma 909:9249). No React, no network.
 */

/** Recommended · Cheapest · Fastest · One courier for all. */
export type BulkRule = BulkMode

export const BULK_RULES: readonly BulkRule[] = ['recommended', 'cheapest', 'fastest', 'one']

/** What the Edit popup (Figma 913:9698) changed for one order. Absent keys follow the batch. */
export type OrderEdit = {
  weightGrams?: number | undefined
  dimensionsCm?: Dimensions | undefined
  /** The box picked in the popup, for its label: a box id, or `custom`. */
  boxId?: string | undefined
  paymentMode?: 'cod' | 'prepaid' | undefined
  insured?: boolean | undefined
  /** The courier row picked by hand; beats the rule. */
  optionKey?: string | undefined
}

export type BulkProblem =
  /** Not bookable here at all (no address, held, several parcels...). */
  | { kind: 'blocked'; reason: BulkSkip['reason'] }
  /** A product has no weight: the couriers would price a guess. */
  | { kind: 'needs_package'; box: boolean }
  /** Cash on delivery and no courier takes COD to this PIN. */
  | { kind: 'no_cod' }
  /** No courier delivers here. */
  | { kind: 'no_courier' }
  /** "One courier for all": that courier cannot take this order. */
  | { kind: 'not_this_courier' }
  /** Delivery options app: the route the shopper paid for cannot be booked. */
  | { kind: 'checkout_route'; route: string }

export type BulkLine = {
  order: DraftOrder
  parcel: DraftParcel | null
  paymentMode: 'cod' | 'prepaid'
  insured: boolean
  /** The couriers' answer; null while asking (or not asked: a problem found before). */
  quote: ParcelQuote | null
  /** The quote's rows as the merchant pays for them (insurance added when on). */
  rows: CourierRateRow[]
  pick: CourierRateRow | null
  /** The pick came from the Edit popup, not the rule. */
  byHand: boolean
  status: 'checking' | 'ready' | 'problem'
  problem: BulkProblem | null
}

/** Weight missing on a product, and no weight typed in the popup. Box alone is no problem:
 *  couriers price the dead weight. */
export function missingPackage(
  parcel: DraftParcel,
  edit: OrderEdit | undefined,
): { box: boolean } | null {
  if (edit?.weightGrams) return null
  if (!parcel.lines.some((l) => l.weightGrams === null)) return null
  return { box: !edit?.dimensionsCm && !parcel.dimensionsCm && !parcel.boxName }
}

/** A box with every side at least 1 cm, else undefined (the server's rule). */
const usableDims = (d: Dimensions | null | undefined): Dimensions | undefined =>
  d && d.length >= 1 && d.width >= 1 && d.height >= 1 ? d : undefined

/** The couriers' question for one order: its own package unless the popup changed it. */
export function orderQuoteRequest(order: DraftOrder, parcel: DraftParcel, edit?: OrderEdit) {
  const weight = edit?.weightGrams ?? parcel.weightGrams
  const declared = Number.isFinite(parcel.valuePaise) ? Math.round(parcel.valuePaise) : -1
  return {
    orderId: order.orderId,
    fulfillmentOrderId: parcel.id,
    pickupLocationId: parcel.pickupLocationId,
    weightGrams:
      Number.isFinite(weight) && Math.round(weight) >= 1 ? Math.round(weight) : undefined,
    dimensionsCm: usableDims(edit?.dimensionsCm) ?? usableDims(parcel.dimensionsCm),
    paymentMode: edit?.paymentMode ?? order.paymentMode,
    declaredValuePaise: declared >= 0 ? declared : undefined,
  }
}

/** The cheapest priced row, else the first; null for none. */
function cheapestOf(rows: CourierRateRow[]): CourierRateRow | null {
  const priced = rows.filter((r) => r.pricePaise !== null)
  if (!priced.length) return rows[0] ?? null
  return priced.reduce((a, b) => ((b.pricePaise as number) < (a.pricePaise as number) ? b : a))
}

/** The row the rule gives one order. The route its shopper paid for wins whatever the rule;
 *  "one courier for all" takes that courier's cheapest service; otherwise the row with the
 *  rule's badge, else the recommended one, else the cheapest that can take it. */
export function rulePick(
  rows: readonly CourierRateRow[],
  checkout: ParcelQuote['checkout'],
  rule: BulkRule,
  providerId: string | null,
): CourierRateRow | null {
  const bookable = rows.filter(isBookable)
  if (checkout) return bookable.find((o) => o.chosenAtCheckout) ?? null
  if (rule === 'one') return cheapestOf(bookable.filter((o) => o.providerId === providerId))
  return (
    bookable.find((o) => o.badges.includes(rule)) ??
    bookable.find((o) => o.badges.includes('recommended')) ??
    cheapestOf(bookable)
  )
}

/** Why no courier row could be picked for an order whose couriers answered. */
export function courierProblem(
  quote: ParcelQuote,
  paymentMode: 'cod' | 'prepaid',
  rule: BulkRule,
): BulkProblem {
  const c = quote.checkout
  if (c) return { kind: 'checkout_route', route: `${c.carrier} ${c.serviceLabel}`.trim() }
  const bookable = quote.options.filter(isBookable)
  if (bookable.length > 0 && rule === 'one') return { kind: 'not_this_courier' }
  if (paymentMode === 'cod' && quote.options.some((o) => o.problem === 'no_cod')) {
    return { kind: 'no_cod' }
  }
  return { kind: 'no_courier' }
}

/** Insurance for one order: the popup's switch, else on when the batch's switch is on or the
 *  shopper paid for it at checkout. */
export const orderInsured = (order: DraftOrder, edit: OrderEdit | undefined, all: boolean) =>
  edit?.insured ?? (all || order.deliveryChoice?.insured === true)

/** Every ticked order as the table shows it. */
export function bulkLines(input: {
  draft: ShipmentDraft
  quotes: Readonly<Record<string, ParcelQuote>>
  /** Orders whose couriers are being asked now. */
  asking: ReadonlySet<string>
  edits: Readonly<Record<string, OrderEdit>>
  rule: BulkRule
  providerId: string | null
  insuredAll: boolean
}): BulkLine[] {
  const { draft, quotes, asking, edits, rule, providerId, insuredAll } = input
  return draft.orders.map((order): BulkLine => {
    const edit = edits[order.orderId]
    const parcel = order.parcels.length === 1 ? (order.parcels[0] ?? null) : null
    const paymentMode = edit?.paymentMode ?? order.paymentMode
    const insured = orderInsured(order, edit, insuredAll)
    const base = { order, parcel, paymentMode, insured, quote: null, rows: [], pick: null }
    const problemLine = (problem: BulkProblem): BulkLine => ({
      ...base,
      byHand: false,
      status: 'problem',
      problem,
    })
    if (order.blocked) return problemLine({ kind: 'blocked', reason: order.blocked })
    if (!parcel) return problemLine({ kind: 'blocked', reason: 'several_parcels' })
    const missing = missingPackage(parcel, edit)
    if (missing) return problemLine({ kind: 'needs_package', box: missing.box })
    const quote = quotes[order.orderId] ?? null
    if (!quote || asking.has(order.orderId)) {
      return { ...base, quote, byHand: false, status: 'checking', problem: null }
    }
    const rows = insuredRows(quote.options, insured)
    const hand = edit?.optionKey
      ? rows.find((r) => r.optionKey === edit.optionKey && isBookable(r))
      : undefined
    const pick = hand ?? rulePick(rows, quote.checkout, rule, providerId)
    return {
      ...base,
      quote,
      rows,
      pick,
      byHand: hand !== undefined,
      status: pick ? 'ready' : 'problem',
      problem: pick ? null : courierProblem(quote, paymentMode, rule),
    }
  })
}

/** Ticked: ready and not unticked by the merchant. A problem row can never be ticked. */
export const isTicked = (line: BulkLine, unticked: ReadonlySet<string>) =>
  line.status === 'ready' && !unticked.has(line.order.orderId)

export type BulkSummary = {
  /** Orders that will book. */
  ready: number
  total: number
  /** Rows with a problem: skipped unless fixed. */
  attention: number
  /** What the ticked rows cost, insurance and GST included. */
  totalPaise: number
  /** Ticked rows whose courier prices on booking. */
  unpriced: number
  /** The ticked rows' cost per courier account, for the wallets line. */
  byProvider: Record<string, number>
}

export function bulkSummary(lines: readonly BulkLine[], unticked: ReadonlySet<string>) {
  const out: BulkSummary = {
    ready: 0,
    total: lines.length,
    attention: 0,
    totalPaise: 0,
    unpriced: 0,
    byProvider: {},
  }
  for (const line of lines) {
    if (line.status === 'problem') out.attention += 1
    if (!isTicked(line, unticked) || !line.pick) continue
    out.ready += 1
    const price = line.pick.pricePaise
    if (price === null) {
      out.unpriced += 1
      continue
    }
    out.totalPaise += price
    out.byProvider[line.pick.providerId] = (out.byProvider[line.pick.providerId] ?? 0) + price
  }
  return out
}

/** What `shipments.bulkBook` takes for the ticked rows: each with its courier and service,
 *  the parcel it was quoted for, and its own package, payment and insurance. */
export function bulkBookRequest(
  lines: readonly BulkLine[],
  unticked: ReadonlySet<string>,
  edits: Readonly<Record<string, OrderEdit>>,
) {
  const booking = lines.filter((l) => isTicked(l, unticked) && l.pick && l.quote)
  const picks = Object.fromEntries(booking.map((l) => [l.order.orderId, l.pick]))
  const quotes = booking.flatMap((l) => (l.quote ? [l.quote] : []))
  const { orderIds, courierOverrides, serviceOverrides, parcelIds } = bulkOrders(picks, quotes)
  const perOrder: Record<
    string,
    {
      weightGrams?: number
      dimensionsCm?: Dimensions
      paymentMode?: 'cod' | 'prepaid'
      insured: boolean
    }
  > = {}
  for (const l of booking) {
    const e = edits[l.order.orderId]
    perOrder[l.order.orderId] = {
      insured: l.insured,
      ...(e?.weightGrams ? { weightGrams: Math.round(e.weightGrams) } : {}),
      ...(usableDims(e?.dimensionsCm) ? { dimensionsCm: e?.dimensionsCm } : {}),
      ...(e?.paymentMode && e.paymentMode !== l.order.paymentMode
        ? { paymentMode: e.paymentMode }
        : {}),
    }
  }
  return {
    orderIds,
    courierOverrides,
    ...(Object.keys(serviceOverrides).length ? { serviceOverrides } : {}),
    ...(Object.keys(parcelIds).length ? { parcelIds } : {}),
    perOrder,
  }
}

/** Where a row's pick came from, for the Courier cell's hint ("Recommended · Change"). */
export type PickSource = 'shopper' | 'hand' | 'rule' | 'via' | 'own'

export function pickSource(line: BulkLine, rule: BulkRule): PickSource {
  const pick = line.pick
  if (!pick) return 'own'
  if (pick.chosenAtCheckout) return 'shopper'
  if (line.byHand) return 'hand'
  if (rule !== 'one' && pick.badges.includes(rule)) return 'rule'
  return pick.providerName && !pick.providerLabel.includes(pick.providerName) ? 'via' : 'own'
}

export type BookResult = {
  orderId: string
  ok: boolean
  shipmentId?: string | undefined
  waybill?: string | undefined
  labelUrl?: string | null | undefined
  error?: string | undefined
}

export type PickupGroup = {
  providerId: string
  label: string
  shipmentIds: string[]
  /** Charged weight of its parcels, as quoted. */
  grams: number
  /** The courier takes pickup requests from here. */
  canPickup: boolean
}

/** The booked parcels grouped by courier account: one pickup request each (Figma 909:9249). */
export function pickupGroups(
  results: readonly BookResult[],
  lines: readonly BulkLine[],
  couriers: ShipmentDraft['couriers'],
): PickupGroup[] {
  const byOrder = new Map(lines.map((l) => [l.order.orderId, l]))
  const groups = new Map<string, PickupGroup>()
  for (const r of results) {
    const line = byOrder.get(r.orderId)
    if (!r.ok || !r.shipmentId || !line?.pick) continue
    const id = line.pick.providerId
    const courier = couriers.find((c) => c.id === id)
    const group = groups.get(id) ?? {
      providerId: id,
      label: courier?.label ?? line.pick.providerName,
      shipmentIds: [],
      grams: 0,
      canPickup: courier?.hasPickup ?? false,
    }
    group.shipmentIds.push(r.shipmentId)
    group.grams += line.pick.chargeableWeightGrams ?? line.quote?.chargedWeightGrams ?? 0
    groups.set(id, group)
  }
  return [...groups.values()]
}
