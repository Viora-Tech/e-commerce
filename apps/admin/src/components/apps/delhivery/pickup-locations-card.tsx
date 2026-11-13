'use client'

import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import { delhiveryAppContent } from '@/data/delhivery'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { pickupWhen } from './pickup-when'

type Places = Awaited<ReturnType<typeof api.shipments.courierPickupPlaces>>

type PickupLocationsCardProps = {
  /** null while loading. */
  places: Places | null
}

/** Figma 928:11256 "Pickup locations": each place, the default marked, its next pickup. */
export default function PickupLocationsCard({ places }: PickupLocationsCardProps) {
  // Hooks
  const { overview: copy } = useCopy(delhiveryAppContent)
  const format = useFormat()

  // Render logic
  const p = copy.pickup

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border surface-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-body font-semibold text-ink-strong">{p.title}</h2>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={routes.settings.locations()} />}
        >
          {p.add}
        </Button>
      </div>
      {places === null ? (
        <span className="h-10 animate-pulse rounded bg-muted" />
      ) : places.length === 0 ? (
        <p className="text-caption text-muted-foreground">{p.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {places.map((place) => (
            <li key={place.locationId ?? 'own'} className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-body text-ink-strong">{place.pickupName}</span>
                  <span className="text-caption text-muted-foreground">
                    {[[place.city, place.pincode].filter(Boolean).join(' '), p.registered]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                {place.isDefault ? <StatusChip className="shrink-0">{p.default}</StatusChip> : null}
              </div>
              <span className="text-caption text-muted-foreground">
                {place.nextPickup
                  ? p.next(
                      pickupWhen(format, place.nextPickup.date, place.nextPickup.timeFrom),
                      place.nextPickup.parcels,
                    )
                  : p.noNext}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
