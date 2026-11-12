import type { LineAvailability, ParcelSplitReason } from '@commerce/core'
import type { DraftParcel, ShipmentDraft } from './flow-state'

/**
 * Partial shipment (Figma 916:10179), the pure parts: what Create shipment ticks to start with,
 * the parcel as it ships now (its items, weight and value) and the split sent with the booking.
 * No React, no network, so the tests cover what the page decides.
 */

/** How many of each line ship now, why the rest waits, and whether the customer is told. */
export type SplitPlan = {
  counts: Record<string, number>
  reason: ParcelSplitReason
  notify: boolean
}

type Line = DraftParcel['lines'][number]

/** The courier's weight for a product with none saved (`ASSUMED_WEIGHT_GRAMS` on the server). */
const ASSUMED_GRAMS = 500

/** What can go now: the units on the shelf; a waiting pre-order stays behind. */
const readyUnits = (l: Line) => Math.min(l.quantity, Math.max(0, l.availability.inStock))

/**
 * The start: every unit that is on the shelf is ticked. When nothing is, or everything is, the
 * whole parcel is ticked (a split needs something on each side).
 */
export function startingPlan(lines: readonly Line[]): SplitPlan {
  const ready = Object.fromEntries(lines.map((l) => [l.id, readyUnits(l)]))
  const now = lines.reduce((n, l) => n + (ready[l.id] ?? 0), 0)
  const units = lines.reduce((n, l) => n + l.quantity, 0)
  const split = now > 0 && now < units
  return {
    counts: split ? ready : Object.fromEntries(lines.map((l) => [l.id, l.quantity])),
    reason: 'not_ready',
    notify: true,
  }
}

/** Some units go now and some stay: the booking splits the parcel first. */
export function isPartial(lines: readonly Line[], counts: Record<string, number>): boolean {
  const now = lines.reduce((n, l) => n + (counts[l.id] ?? 0), 0)
  const units = lines.reduce((n, l) => n + l.quantity, 0)
  return now > 0 && now < units
}

/** The parcel as it ships now: the ticked units, their weight and their share of the value. */
export function plannedParcel(parcel: DraftParcel, counts: Record<string, number>): DraftParcel {
  if (!isPartial(parcel.lines, counts)) return parcel
  const goods = (n: (l: Line) => number) =>
    parcel.lines.reduce((t, l) => t + l.unitPricePaise * n(l), 0)
  const all = goods((l) => l.quantity)
  const kept = goods((l) => counts[l.id] ?? 0)
  const removedGrams = parcel.lines.reduce(
    (t, l) => t + (l.quantity - (counts[l.id] ?? 0)) * (l.weightGrams ?? ASSUMED_GRAMS),
    0,
  )
  return {
    ...parcel,
    lines: parcel.lines.flatMap((l) => {
      const quantity = counts[l.id] ?? 0
      return quantity > 0 ? [{ ...l, quantity }] : []
    }),
    valuePaise: all > 0 ? Math.round((parcel.valuePaise * kept) / all) : parcel.valuePaise,
    weightGrams: Math.max(1, Math.round(parcel.weightGrams - removedGrams)),
  }
}

/** The draft with one parcel shown as it ships now (the quote asks for that value). */
export function plannedDraft(
  draft: ShipmentDraft,
  parcelId: string | null,
  plan: SplitPlan | null,
): ShipmentDraft {
  if (!plan) return draft
  return {
    ...draft,
    orders: draft.orders.map((o) => ({
      ...o,
      parcels: o.parcels.map((p) => (p.id === parcelId ? plannedParcel(p, plan.counts) : p)),
    })),
  }
}

/** `shipments.splitParcel`'s `keep`: every line of the parcel, with what ships now. */
export const keepOf = (lines: readonly Line[], counts: Record<string, number>) =>
  lines.map((l) => ({ orderLineId: l.id, quantity: counts[l.id] ?? 0 }))

/** The chip an item gets: a waiting pre-order, or how many of it are on the shelf. */
export function availabilityNote(
  a: LineAvailability,
  quantity: number,
): { kind: 'preorder'; date: string | null } | { kind: 'stock'; n: number } | null {
  if (a.preorder) return { kind: 'preorder', date: a.preorder.arrivesOn }
  if (a.inStock < quantity) return { kind: 'stock', n: a.inStock }
  return null
}
