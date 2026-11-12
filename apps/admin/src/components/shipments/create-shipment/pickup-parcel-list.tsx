'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import { todayKey } from '@/lib/format-date'

type Options = Awaited<ReturnType<typeof api.shipments.listPickupOptions>>
export type PickupGroup = Options['groups'][number]

type PickupParcelListProps = {
  group: PickupGroup
  picked: string[]
  onToggle: (shipmentId: string, on: boolean) => void
  /** The order numbers already on the pickup being joined (Figma 906:8464 "Already in it"). */
  alreadyIn: number[] | null
}

type Parcel = PickupGroup['parcels'][number]

/**
 * Figma 905:8280 "Parcels in this pickup": the parcels the drawer was opened for, then the
 * courier's other booked parcels from the same place still without a pickup, each tickable.
 */
export default function PickupParcelList({
  group,
  picked,
  onToggle,
  alreadyIn,
}: PickupParcelListProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.pickupDrawer)
  const fmt = useFormat()

  // Helpers
  const kg = (grams: number | null) =>
    grams ? copy.weight(fmt.number(Math.round(grams / 10) / 100)) : null
  const detail = (p: Parcel) =>
    p.anchor
      ? [p.customerName, p.city, kg(p.weightGrams)].filter(Boolean).join(' · ')
      : [
          copy.bookedEarlier(
            todayKey(new Date(p.createdAt)) === todayKey()
              ? copy.earlierToday
              : fmt.pattern(p.createdAt, { day: 'numeric', month: 'short' }),
            group.providerLabel,
          ),
          kg(p.weightGrams),
        ]
          .filter(Boolean)
          .join(' · ')

  const row = (p: Parcel) => (
    <li key={p.shipmentId}>
      <label
        htmlFor={`pickup-parcel-${p.shipmentId}`}
        className="flex cursor-pointer items-start gap-3 py-1.5"
      >
        <Checkbox
          id={`pickup-parcel-${p.shipmentId}`}
          className="mt-0.5"
          checked={picked.includes(p.shipmentId)}
          onCheckedChange={(on) => onToggle(p.shipmentId, on === true)}
          aria-label={copy.tick(p.orderNumber)}
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body font-medium text-ink-strong">
            {copy.parcelTitle(p.orderNumber, p.waybill)}
          </span>
          <span className="truncate text-caption text-muted-foreground">{detail(p)}</span>
        </span>
      </label>
    </li>
  )

  // Render logic
  const anchors = group.parcels.filter((p) => p.anchor)
  const others = group.parcels.filter((p) => !p.anchor)
  const total = picked.length + (alreadyIn?.length ?? 0)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
        {alreadyIn ? copy.parcelsCount(total) : copy.parcels}
      </p>
      <ul className="flex flex-col">{anchors.map(row)}</ul>
      {alreadyIn && alreadyIn.length > 0 ? (
        <p className="text-caption text-muted-foreground">
          {copy.alreadyIn(alreadyIn.map((n) => `#${n}`).join(', '))}
        </p>
      ) : null}
      {others.length > 0 ? (
        <>
          <ul className="flex flex-col">{others.map(row)}</ul>
          <p className="text-caption text-muted-foreground">
            {alreadyIn
              ? copy.waitingJoin(others.length, group.providerLabel)
              : copy.waiting(others.length, group.providerLabel)}
          </p>
        </>
      ) : null}
    </div>
  )
}
