'use client'

import type { ParcelView } from '@commerce/core'
import type { OrderDeliveryParcelRoute } from '@commerce/db'
import { deliveryRouteCardContent } from '@/data/order-cards'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { cap } from './order-detail-types'

type DeliveryParcelRoutesProps = {
  /** Each parcel's route saved at checkout (`OrderDeliveryRoute.parcels`). */
  routes: OrderDeliveryParcelRoute[]
  /** The order's parcels, for their number and place. */
  parcels: ParcelView[]
}

/**
 * The parcel a saved route belongs to: the one stamped on it, else the first not yet matched
 * at its location (a pre-order route to the pre-order parcel first), the way booking matches.
 */
function parcelFor(
  route: OrderDeliveryParcelRoute,
  parcels: ParcelView[],
  taken: Set<string>,
): ParcelView | undefined {
  const byId = route.fulfillmentOrderId
    ? parcels.find((p) => p.id === route.fulfillmentOrderId)
    : undefined
  const here = parcels.filter((p) => p.locationId === route.locationId && !taken.has(p.id))
  const found =
    byId ?? here.find((p) => (p.status === 'on_hold') === route.onHold) ?? here[0] ?? undefined
  if (found) taken.add(found.id)
  return found
}

/** One line per parcel of a split cart: where it leaves from, its courier, insurance, promise. */
export default function DeliveryParcelRoutes({ routes, parcels }: DeliveryParcelRoutesProps) {
  // Hooks
  const copy = useCopy(deliveryRouteCardContent)
  const fmt = useFormat()

  // Helpers
  const range = (earliest: string | null, latest: string | null) =>
    earliest && latest
      ? earliest === latest
        ? fmt.date(earliest)
        : `${fmt.date(earliest)} – ${fmt.date(latest)}`
      : null

  // Render logic
  const taken = new Set<string>()
  const rows = routes.map((r, i) => {
    const parcel = parcelFor(r, parcels, taken)
    const promised = range(r.promisedEarliest, r.promisedLatest)
    return {
      key: r.fulfillmentOrderId ?? `${r.locationId}:${i}`,
      title: copy.parcelFrom(parcel?.position ?? i + 1, parcel?.locationName ?? copy.otherPlace),
      courier: r.route
        ? `${r.route.carrier} · ${
            r.route.channel === 'aggregator'
              ? copy.via(r.route.serviceLabel, cap(r.route.providerId))
              : r.route.serviceLabel
          }`
        : copy.noRoute,
      facts: [
        r.onHold ? copy.preorder : null,
        r.insured ? copy.insured : null,
        promised ? copy.promised(promised) : null,
      ].filter(Boolean),
    }
  })

  return (
    <ul className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-0.5">
          <p className="font-medium text-ink-strong">{row.title}</p>
          <p className="text-caption text-muted-foreground">{row.courier}</p>
          {row.facts.length ? (
            <p className="text-caption text-muted-foreground">{row.facts.join(' · ')}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
