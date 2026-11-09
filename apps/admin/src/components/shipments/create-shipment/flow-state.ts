import type { CourierRateRow } from '@commerce/core'
import { parseRupees } from '@commerce/money'
import type { api } from '@/lib/api-client'

/**
 * The Create shipment flow's pure parts: step 1's form and what it sends, step 2's
 * recommended pick, and the bulk flow's per-order courier choice. No React, no network, so
 * the tests cover what the dialog decides.
 */

export type ShipmentDraft = Awaited<ReturnType<typeof api.shipments.prepare>>
export type DraftOrder = ShipmentDraft['orders'][number]
export type DraftParcel = DraftOrder['parcels'][number]
export type ParcelQuote = Awaited<ReturnType<typeof api.shipments.quote>>[number]
export type Dimensions = { length: number; width: number; height: number }

/** Step 2's "Ship it yourself" choice: no courier app, the merchant types the AWB. */
export const MANUAL = 'manual'
/** Step 1's box choices besides the store's named boxes. */
export const CUSTOM_BOX = 'custom'
export const PRODUCT_BOX = 'product'
/** Pickup select's value for Settings › Shipping's address, which has no location id. */
export const STORE_ADDRESS = 'store'

export type PackageForm = {
  parcelId: string | null
  /** A location id, or null for Settings › Shipping's address. */
  pickupLocationId: string | null
  boxId: string
  weightGrams: string
  length: string
  width: string
  height: string
  paymentMode: 'cod' | 'prepaid'
  /** Rupees, as typed. */
  codAmount: string
}

export type ParsedPackage = {
  weightGrams: number
  dimensionsCm: Dimensions | undefined
  paymentMode: 'cod' | 'prepaid'
  codAmountPaise: number | undefined
}

const text = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))

/** The box a parcel starts in: the products' own box, else the store's main box, else custom. */
function startingBox(parcel: DraftParcel, draft: ShipmentDraft): string {
  if (parcel.dimensionsCm) return PRODUCT_BOX
  return draft.defaultBoxId ?? CUSTOM_BOX
}

/** Step 1 pre-filled from the parcel: its weight and box, where it leaves from, how it's paid. */
export function packageFor(
  order: DraftOrder,
  parcel: DraftParcel,
  draft: ShipmentDraft,
): PackageForm {
  const boxId = startingBox(parcel, draft)
  const box = draft.boxes.find((b) => b.id === boxId)
  const dims =
    parcel.dimensionsCm ??
    (box ? { length: box.lengthCm, width: box.widthCm, height: box.heightCm } : null)
  return {
    parcelId: parcel.id,
    pickupLocationId: parcel.pickupLocationId,
    boxId,
    weightGrams: text(parcel.weightGrams),
    length: text(dims?.length),
    width: text(dims?.width),
    height: text(dims?.height),
    paymentMode: order.paymentMode,
    codAmount: order.paymentMode === 'cod' ? text(parcel.valuePaise / 100) : '',
  }
}

/** Picking a named box fills its size; the products' own box puts the parcel's back. */
export function withBox(
  form: PackageForm,
  boxId: string,
  parcel: DraftParcel,
  boxes: ShipmentDraft['boxes'],
): PackageForm {
  const box = boxes.find((b) => b.id === boxId)
  const dims = box
    ? { length: box.lengthCm, width: box.widthCm, height: box.heightCm }
    : boxId === PRODUCT_BOX
      ? parcel.dimensionsCm
      : null
  if (!dims) return { ...form, boxId }
  return {
    ...form,
    boxId,
    length: text(dims.length),
    width: text(dims.width),
    height: text(dims.height),
  }
}

const positive = (s: string): number | null => {
  const n = Number(s)
  return s.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null
}

/** The form as numbers, or null while something needed is missing or not a number. */
export function parsePackage(form: PackageForm): ParsedPackage | null {
  const weight = positive(form.weightGrams)
  if (weight === null) return null
  const [length, width, height] = [
    positive(form.length),
    positive(form.width),
    positive(form.height),
  ]
  const dimensionsCm =
    length !== null && width !== null && height !== null ? { length, width, height } : undefined
  let codAmountPaise: number | undefined
  if (form.paymentMode === 'cod') {
    const paise = parseRupees(form.codAmount)
    if (paise === null || paise <= 0) return null
    codAmountPaise = paise
  }
  return {
    weightGrams: Math.round(weight),
    dimensionsCm,
    paymentMode: form.paymentMode,
    codAmountPaise,
  }
}

/** Step 2's question for one parcel, from step 1's answers. */
export function quoteRequest(
  order: DraftOrder,
  parcel: DraftParcel,
  form: PackageForm,
  parsed: ParsedPackage,
) {
  return {
    orderId: order.orderId,
    fulfillmentOrderId: parcel.id,
    pickupLocationId: form.pickupLocationId,
    weightGrams: parsed.weightGrams,
    dimensionsCm: parsed.dimensionsCm,
    paymentMode: parsed.paymentMode,
    declaredValuePaise: parcel.valuePaise,
  }
}

/** A whole number of at least 1, or undefined: the server takes nothing less. */
const atLeastOne = (n: number | null | undefined) =>
  n !== null && n !== undefined && Number.isFinite(n) && Math.round(n) >= 1
    ? Math.round(n)
    : undefined

/** A box with every side at least 1 cm, else undefined (the server's rule). */
const usableDims = (d: Dimensions | null | undefined): Dimensions | undefined =>
  d && d.length >= 1 && d.width >= 1 && d.height >= 1 ? d : undefined

/**
 * The bulk flow's question to the couriers, one row per order, in the same shape the server
 * accepts from the one-order flow: a weight below 1 g (products saved with 0 g), a box with a
 * 0 cm side or a fractional value is left out, so the server uses its own default instead of
 * refusing the whole batch.
 */
export function bulkQuoteRequests(
  ready: ReadonlyArray<{ order: DraftOrder; parcel: DraftParcel }>,
  dims: Dimensions | undefined,
) {
  return ready.map(({ order, parcel }) => {
    const declared = Number.isFinite(parcel.valuePaise) ? Math.round(parcel.valuePaise) : NaN
    return {
      orderId: order.orderId,
      fulfillmentOrderId: parcel.id,
      pickupLocationId: parcel.pickupLocationId,
      weightGrams: atLeastOne(parcel.weightGrams),
      dimensionsCm: usableDims(dims) ?? usableDims(parcel.dimensionsCm),
      paymentMode: order.paymentMode,
      declaredValuePaise: declared >= 0 ? declared : undefined,
    }
  })
}

export const isBookable = (row: CourierRateRow) => row.problem === null

/** The cheapest priced row, else the first; null for none. */
function cheapestOf(rows: CourierRateRow[]): CourierRateRow | null {
  const priced = rows.filter((r) => r.pricePaise !== null)
  if (!priced.length) return rows[0] ?? null
  return priced.reduce((a, b) => ((b.pricePaise as number) < (a.pricePaise as number) ? b : a))
}

/** The pick step 2 starts on: the route the shopper paid for at checkout (Delivery options
 *  app) when it can still be booked; else the courier the merchant came for (a courier app's
 *  Create shipment) when it can take the parcel, its recommended or cheapest service; else the
 *  recommended courier, else the first that can take it, else shipping it yourself. */
export function startingPick(options: CourierRateRow[], preferred?: string | null): string {
  const chosen = options.find((o) => o.chosenAtCheckout && isBookable(o))
  if (chosen) return chosen.optionKey
  const mine = preferred ? options.filter((o) => o.providerId === preferred && isBookable(o)) : []
  const preferredPick = mine.find((o) => o.badges.includes('recommended')) ?? cheapestOf(mine)
  if (preferredPick) return preferredPick.optionKey
  const recommended = options.find((o) => o.badges.includes('recommended'))
  return recommended?.optionKey ?? options.find(isBookable)?.optionKey ?? MANUAL
}

// --- Bulk ------------------------------------------------------------------------------------

export type BulkMode = 'one' | 'cheapest' | 'fastest'

/** Bulk step 1: every parcel keeps its products' own weight and box unless one box is picked. */
export const OWN_WEIGHT = 'own'

export type BulkSkip = {
  order: DraftOrder
  reason: NonNullable<DraftOrder['blocked']> | 'several_parcels'
}

/** Which ticked orders a bulk booking can take: one open parcel and nothing blocking. An order
 *  that ships in several parcels is booked parcel by parcel from its own page. */
export function bulkSplit(orders: DraftOrder[]): {
  ready: Array<{ order: DraftOrder; parcel: DraftParcel }>
  skipped: BulkSkip[]
} {
  const ready: Array<{ order: DraftOrder; parcel: DraftParcel }> = []
  const skipped: BulkSkip[] = []
  for (const order of orders) {
    const [parcel] = order.parcels
    if (order.blocked) skipped.push({ order, reason: order.blocked })
    else if (order.parcels.length > 1) skipped.push({ order, reason: 'several_parcels' })
    else if (parcel) ready.push({ order, parcel })
  }
  return { ready, skipped }
}

export type CourierTotal = {
  providerId: string
  label: string
  /** Sum of the live prices it quoted. */
  pricePaise: number
  /** Orders it can take with no live price (rate on booking). */
  unpriced: number
  /** Orders it can take at all. */
  canTake: number
  recommended: boolean
}

/** "One courier for all": each courier's total across the batch. Recommended takes the most
 *  orders, then costs the least. */
export function courierTotals(
  quotes: ParcelQuote[],
  couriers: ShipmentDraft['couriers'],
): CourierTotal[] {
  const totals = couriers.map((c) => {
    // A courier may quote several services per parcel; the batch counts its cheapest one.
    const rows = quotes.flatMap((q) => {
      const best = cheapestOf(q.options.filter((o) => o.providerId === c.id && isBookable(o)))
      return best ? [best] : []
    })
    return {
      providerId: c.id,
      label: c.label,
      pricePaise: rows.reduce((sum, r) => sum + (r.pricePaise ?? 0), 0),
      unpriced: rows.filter((r) => r.pricePaise === null).length,
      canTake: rows.length,
      recommended: false,
    }
  })
  const best = totals
    .filter((t) => t.canTake > 0)
    .sort(
      (a, b) => b.canTake - a.canTake || a.unpriced - b.unpriced || a.pricePaise - b.pricePaise,
    )[0]
  return totals.map((t) => ({ ...t, recommended: t === best }))
}

/** Bulk step 2's starting choice: "one courier for all" with the courier the merchant came for
 *  when it can take any of the orders, else the default mode on the recommended courier. */
export function startingBulkPick(
  totals: CourierTotal[],
  preferred?: string | null,
): { mode: BulkMode | null; providerId: string | null } {
  const mine = preferred ? totals.find((t) => t.providerId === preferred && t.canTake > 0) : null
  if (mine) return { mode: 'one', providerId: mine.providerId }
  return { mode: null, providerId: totals.find((t) => t.recommended)?.providerId ?? null }
}

/** Each order's courier row under the chosen mode; null when no courier (or not the chosen
 *  one) can take it. */
export function bulkPicks(
  quotes: ParcelQuote[],
  mode: BulkMode,
  providerId: string | null,
): Record<string, CourierRateRow | null> {
  const picks: Record<string, CourierRateRow | null> = {}
  for (const q of quotes) {
    const bookable = q.options.filter(isBookable)
    /* Delivery options app: an order books the route its shopper paid for, whatever the mode;
       when that route fails it waits for the merchant's decision instead of another courier. */
    if (q.checkout) {
      picks[q.orderId] = bookable.find((o) => o.chosenAtCheckout) ?? null
      continue
    }
    const row =
      mode === 'one'
        ? cheapestOf(bookable.filter((o) => o.providerId === providerId))
        : (bookable.find((o) => o.badges.includes(mode)) ??
          bookable.find((o) => o.badges.includes('recommended')) ??
          null)
    picks[q.orderId] = row
  }
  return picks
}

/** What `shipments.bulkBook` takes: each bookable order with its courier. */
export function bulkOrders(picks: Record<string, CourierRateRow | null>): {
  orderIds: string[]
  courierOverrides: Record<string, string>
  serviceOverrides: Record<string, string>
} {
  const courierOverrides: Record<string, string> = {}
  const serviceOverrides: Record<string, string> = {}
  for (const [orderId, row] of Object.entries(picks)) {
    if (!row) continue
    courierOverrides[orderId] = row.providerId
    if (row.serviceId) serviceOverrides[orderId] = row.serviceId
  }
  return { orderIds: Object.keys(courierOverrides), courierOverrides, serviceOverrides }
}
