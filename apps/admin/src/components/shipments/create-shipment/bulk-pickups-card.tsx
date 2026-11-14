'use client'

import { DEFAULT_TIME_ZONE, wallClock } from '@commerce/dates'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import StatusChip from '@/components/layout/status-chip'
import { bulkShipContent } from '@/data/bulk-ship'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { todayKey } from '@/lib/format-date'
import { upcomingPickups } from '../pickup-fields'
import type { PickupGroup } from './bulk-ship-state'
import CourierMark from './courier-mark'
import { PICKUP_DAYS, pickupDayKey, pickupRefusal, startingPickupPlan } from './pickup-plan'

type BulkPickupsCardProps = {
  groups: PickupGroup[]
  onLater: () => void
}

type Pickup = Awaited<ReturnType<typeof api.shipments.listPickups>>[number]

const TIMES = ['10:00', '14:00', '16:00'] as const
const DAY = { weekday: 'short', day: 'numeric', month: 'short' } as const

const kg = (grams: number) => Math.round(grams / 10) / 100

/**
 * The bulk result's Pickups card (Figma 909:9249): one row per courier with its parcels and
 * weight. A courier with a pickup already booked for today or later joins it; the others get
 * a new pickup request for the day and time picked above. Each request makes its manifest.
 */
export default function BulkPickupsCard({ groups, onLater }: BulkPickupsCardProps) {
  // Hooks
  const copy = useCopy(bulkShipContent.result)
  const fmt = useFormat()
  const [booked, setBooked] = useState<Pickup[]>([])
  const [slot, setSlot] = useState(() => {
    const plan = startingPickupPlan()
    return `${plan.date}|${plan.timeFrom}`
  })
  const [busy, setBusy] = useState(false)
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
  const handleCreate = async () => {
    const [date = '', timeFrom = '14:00'] = slot.split('|')
    setBusy(true)
    try {
      const made: Array<{ id: string; status: string; error: string | null }> = []
      const fresh: string[] = []
      for (const g of groups.filter((x) => x.canPickup)) {
        const join = joinable(g.providerId)
        if (join) {
          made.push(
            ...(await api.shipments.schedulePickup({
              shipmentIds: g.shipmentIds,
              date: join.scheduledFor,
              timeFrom: join.timeFrom,
              joinPickupId: join.id,
            })),
          )
        } else fresh.push(...g.shipmentIds)
      }
      if (fresh.length > 0) {
        made.push(...(await api.shipments.schedulePickup({ shipmentIds: fresh, date, timeFrom })))
      }
      for (const p of made) {
        if (p.status === 'failed') continue
        await api.shipments.createManifest({ pickupId: p.id }).catch(() => undefined)
      }
      // A courier's refusal is recorded as a failed pickup, not thrown: say why, keep the button.
      const refused = pickupRefusal(made, copy.createFailed)
      if (refused) {
        toast.error(refused)
        return
      }
      toast.success(copy.created)
      setDone(true)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.createFailed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  // Never a time already gone: today offers only the hours still ahead (store clock).
  const hourNow = wallClock(new Date(), DEFAULT_TIME_ZONE).getUTCHours()
  const slots = Array.from({ length: PICKUP_DAYS }, (_, i) => pickupDayKey(i)).flatMap((day, i) => {
    const date = fmt.pattern(day, DAY)
    const label = i === 0 ? copy.today(date) : i === 1 ? copy.tomorrow(date) : date
    return TIMES.filter((t) => i > 0 || Number(t.slice(0, 2)) > hourNow).map((t) => ({
      value: `${day}|${t}`,
      label: copy.slot(label, t),
    }))
  })
  const pickable = groups.filter((g) => g.canPickup)
  const joined = pickable.filter((g) => joinable(g.providerId)).map((g) => g.label)
  const fresh = pickable.length - joined.length

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-body font-semibold text-ink-strong">{copy.pickups}</h3>
          <p className="text-caption text-muted-foreground">{copy.pickupsHelp}</p>
        </div>
        {fresh > 0 && !done ? (
          <div className="w-72">
            <ChoiceField
              id="bulk-pickup-slot"
              label={copy.slotLabel}
              hideLabel
              value={slot}
              options={slots}
              onChange={setSlot}
            />
          </div>
        ) : null}
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
          <p className="text-caption text-muted-foreground">{copy.footnote(fresh, joined)}</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onLater} disabled={busy}>
              {copy.later}
            </Button>
            <Button onClick={() => void handleCreate()} loading={busy}>
              {copy.create}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
