/** SOURCE OF TRUTH: an order's parcels split by product rules — WHAT: `splitByDeliveryRoutes`
 * cuts a routed parcel into one parcel per saved delivery route at its location (each route's
 * `variantIds`), and `parcelRouteFor` finds the route a parcel was priced with / WHY: checkout
 * may price one location's goods as two parcels when their product rules share no courier
 * (owner, 21 Nov 2026); the order must then make two fulfilment orders, so booking makes one
 * label per parcel on the courier the shopper picked for it. Stock is held per location, so the
 * split changes no reservation. Pure.
 */
import type { OrderDeliveryParcelRoute, OrderDeliveryRoute } from '@commerce/db'
import type { RoutedParcel } from './routing'

const onHoldOf = (p: Pick<RoutedParcel, 'status'>) => p.status === 'on_hold'

/** The saved routes at a parcel's location: the same hold state first, else any there. */
function routesAt(
  delivery: OrderDeliveryRoute | null | undefined,
  parcel: Pick<RoutedParcel, 'locationId' | 'status'>,
): OrderDeliveryParcelRoute[] {
  const here = delivery?.parcels?.filter((r) => r.locationId === parcel.locationId) ?? []
  const same = here.filter((r) => r.onHold === onHoldOf(parcel))
  return same.length ? same : here
}

/**
 * The routes split the parcel when more than one at its location names its variants. Lines no
 * route names stay with the first part. Order kept: routed order, then route order.
 */
export function splitByDeliveryRoutes(
  parcels: readonly RoutedParcel[],
  delivery: OrderDeliveryRoute | null | undefined,
  variantOf: (key: string) => string | undefined,
): RoutedParcel[] {
  if (!delivery?.parcels?.some((r) => r.variantIds?.length)) return [...parcels]
  return parcels.flatMap((parcel) => {
    const routes = routesAt(delivery, parcel).filter((r) =>
      parcel.lines.some((l) => r.variantIds?.includes(variantOf(l.key) ?? '')),
    )
    if (routes.length < 2) return [parcel]
    const owner = (key: string) => {
      const at = routes.findIndex((r) => r.variantIds?.includes(variantOf(key) ?? ''))
      return at < 0 ? 0 : at
    }
    return routes
      .map((_, i) => ({ ...parcel, lines: parcel.lines.filter((l) => owner(l.key) === i) }))
      .filter((p) => p.lines.length > 0)
  })
}

/**
 * The saved route a parcel was priced with: the one at its location and hold state naming its
 * variants, else the first there (as before rule splits). Null when none was saved there.
 */
export function parcelRouteFor(
  delivery: OrderDeliveryRoute | null | undefined,
  parcel: Pick<RoutedParcel, 'locationId' | 'status' | 'lines'>,
  variantOf: (key: string) => string | undefined,
): OrderDeliveryParcelRoute | null {
  const routes =
    delivery?.parcels?.filter(
      (r) => r.locationId === parcel.locationId && r.onHold === onHoldOf(parcel),
    ) ?? []
  const own = routes.find((r) =>
    parcel.lines.some((l) => r.variantIds?.includes(variantOf(l.key) ?? '')),
  )
  return own ?? routes[0] ?? null
}
