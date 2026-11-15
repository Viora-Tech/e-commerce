'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import { appsContent } from '@/data/apps'
import { delhiveryAppContent } from '@/data/delhivery'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { pickupWhen } from './pickup-when'

type Places = Awaited<ReturnType<typeof api.shipments.courierPickupPlaces>>

type PickupLocationsCardProps = {
  /** null while loading. */
  places: Places | null
  /** The read failed: "Could not load the pickup locations" with Try again. */
  failed?: boolean
  onRetry?: () => void
}

/** Figma 928:11256 "Pickup locations": each place, the default marked, its next pickup. */
export default function PickupLocationsCard({
  places,
  failed = false,
  onRetry = () => undefined,
}: PickupLocationsCardProps) {
  // Hooks
  const apps = useCopy(appsContent)
  const { overview: copy } = useCopy(delhiveryAppContent)
  const format = useFormat()

  // Render logic
  const p = copy.pickup

  return (
    <DataCard
      title={p.title}
      action={
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={routes.settings.locations()} />}
        >
          {p.add}
        </Button>
      }
    >
      {failed ? (
        <LoadFailedState heading={apps.couldNotLoad.pickupLocations} onRetry={onRetry} />
      ) : places === null ? (
        // One place: its name, the city line and the next pickup.
        <div className="flex flex-col gap-1.5" aria-busy="true">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-3 w-48" />
        </div>
      ) : places.length === 0 ? (
        <EmptyState variant="inline" body={p.empty} />
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
    </DataCard>
  )
}
