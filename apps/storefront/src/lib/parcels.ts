import 'server-only'
import type { ParcelView } from '@commerce/core'
import type { ParcelDeliveryEstimate } from '@commerce/db'
import { formatDeliveryRange } from '@commerce/shipping'

/** One parcel as the shopper sees it: where from, what is in it, when it arrives. */
export type ShopperParcel = {
  /** Stable React key: the parcel's id once placed, its location and hold state before. */
  key: string
  /** "New Delhi, Delhi", else the location's name. */
  from: string
  /** `variantId` at checkout only: tells a parcel split by product rules what it holds. */
  items: { title: string; quantity: number; variantId?: string | undefined }[]
  /** "Tue, 18 Aug - Thu, 20 Aug"; null when no estimate was worked out. */
  dateRange: string | null
  /** Pre-order items that ship once they arrive. */
  onHold: boolean
  locationId: string
  estimate: ParcelDeliveryEstimate | null
}

/** "Kurta / M" without the placeholder variant name. */
export const itemTitle = (title: string, variant: string | null) =>
  variant && variant !== 'Default' && variant !== 'Default Title' ? `${title} / ${variant}` : title

/** "New Delhi, Delhi", else the warehouse's name. */
export const parcelFrom = (p: {
  city: string | null
  stateName: string | null
  locationName: string
}) => [p.city, p.stateName].filter(Boolean).join(', ') || p.locationName

/**
 * The location parcels cut the way checkout priced them: a cart whose products' rules share no
 * courier ships one location's goods as several parcels (keys `loc:open:1`, `loc:open:2`, owner
 * 21 Nov 2026), each with only its own items. Unchanged when nothing was split by rule.
 */
export function pricedParcels(
  located: readonly ShopperParcel[],
  priced: ReadonlyArray<{ key: string; variantIds: readonly string[] }>,
): ShopperParcel[] {
  if (!priced.some((p) => p.key.split(':').length > 2)) return [...located]
  const home = (key: string) => located.find((l) => key === l.key || key.startsWith(`${l.key}:`))
  const cut = priced.flatMap((p) => {
    const at = home(p.key)
    if (!at) return []
    const items = at.items.filter((i) => i.variantId && p.variantIds.includes(i.variantId))
    return [{ ...at, key: p.key, items }]
  })
  const left = located.filter((l) => !priced.some((p) => home(p.key) === l))
  return [...cut, ...left]
}

/** A placed order's parcels as the thank-you and order pages show them (cancelled ones left out). */
export function shopperParcels(views: readonly ParcelView[]): ShopperParcel[] {
  return views
    .filter((p) => p.status !== 'cancelled')
    .map((p) => ({
      key: p.id,
      from: parcelFrom(p),
      items: p.lines.map((l) => ({
        title: itemTitle(l.title ?? '', l.variantTitle),
        quantity: l.quantity,
      })),
      dateRange: p.deliveryEstimate
        ? formatDeliveryRange(p.deliveryEstimate.earliest, p.deliveryEstimate.latest)
        : null,
      onHold: p.status === 'on_hold',
      locationId: p.locationId,
      estimate: p.deliveryEstimate,
    }))
}
