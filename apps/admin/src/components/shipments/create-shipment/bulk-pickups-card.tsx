'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import StatusChip from '@/components/layout/status-chip'
import { bulkShipContent } from '@/data/bulk-ship'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { todayKey } from '@/lib/format-date'
import { upcomingPickups } from '../pickup-fields'
import type { PickupGroup } from './bulk-ship-state'
import CourierMark from './courier-mark'
import PickupDrawer from './pickup-drawer'

type BulkPickupsCardProps = {
  groups: PickupGroup[]
  onLater: () => void
}

type Pickup = Awaited<ReturnType<typeof api.shipments.listPickups>>[number]

const DAY = { weekday: 'short', day: 'numeric', month: 'short' } as const

const kg = (grams: number) => Math.round(grams / 10) / 100

/**
 * The bulk result's Pickups card (Figma 909:9249): one row per courier with its parcels and
 * weight, and whether that courier already has a pickup booked. Create pickups opens the same
 * Create pickup drawer as a single order (Figma 905:8280): per courier and place, the merchant
 * picks the day (today greyed after the cut-off) and time, or adds the parcels to a pickup
 * already booked that day (Figma 906:8464). Nothing is sent before that choice.
 */
export default function BulkPickupsCard({ groups, onLater }: BulkPickupsCardProps) {
  // Hooks
  const copy = useCopy(bulkShipContent.result)
  const fmt = useFormat()
  const [booked, setBooked] = useState<Pickup[]>([])
  const [choosing, setChoosing] = useState(false)
  const [done, setDone] = useState(false)
  useEffect(() => {
    let live = true
    api.shipments
      .listPickups()
      .then((rows) => live && setBooked(upcomingPickups(rows, todayKey())))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

  // Helpers
  const joinable = (providerId: string) => booked.find((p) => p.provider === providerId)

  // Event handlers
  const handleDone = () => setDone(true)

  // Render logic
  const pickable = groups.filter((g) => g.canPickup)
  const shipmentIds = pickable.flatMap((g) => g.shipmentIds)

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex min-w-0 flex-col gap-0.5 p-5">
        <h3 className="text-body font-semibold text-ink-strong">{copy.pickups}</h3>
        <p className="text-caption text-muted-foreground">{copy.pickupsHelp}</p>
      </div>
      <ul className="flex flex-col divide-y divide-hairline border-t border-hairline">
        {groups.map((g) => {
          const join = joinable(g.providerId)
          return (
            <li key={g.providerId} className="flex items-center gap-4 px-5 py-3.5">
              <CourierMark label={g.label} className="h-9 w-16" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium text-ink-strong">{g.label}</span>
                <span className="text-caption text-muted-foreground">
                  {copy.parcels(g.shipmentIds.length, fmt.number(kg(g.grams)))}
                </span>
              </div>
              {!g.canPickup ? (
                <StatusChip variant="outline">{copy.dropOff}</StatusChip>
              ) : done ? (
                <StatusChip tone="success" variant="outline">
                  {copy.onPickup}
                </StatusChip>
              ) : join ? (
                <StatusChip tone="info" variant="outline">
                  {copy.alreadyBooked(
                    `${fmt.pattern(join.scheduledFor, DAY)}, ${join.timeFrom}`,
                    join.providerRef,
                  )}
                </StatusChip>
              ) : (
                <StatusChip variant="outline">{copy.newRequest}</StatusChip>
              )}
            </li>
          )
        })}
      </ul>
      {pickable.length > 0 && !done ? (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-muted/40 px-5 py-4">
          <p className="text-caption text-muted-foreground">{copy.footnote}</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onLater}>
              {copy.later}
            </Button>
            <Button onClick={() => setChoosing(true)}>{copy.create}</Button>
          </div>
        </div>
      ) : null}
      <PickupDrawer
        open={choosing}
        onOpenChange={setChoosing}
        shipmentIds={shipmentIds}
        onDone={handleDone}
      />
    </section>
  )
}
