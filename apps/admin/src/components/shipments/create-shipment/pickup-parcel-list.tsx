'use client'

import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'

type Options = Awaited<ReturnType<typeof api.shipments.listPickupOptions>>
export type PickupGroup = Options['groups'][number]

type PickupParcelListProps = {
  group: PickupGroup
}

/**
 * The parcel the Create pickup drawer was opened for (the one just booked; a split order's
 * parcels for this courier and place), nothing else. The courier's other booked parcels are
 * sent from Shipments → Booked (tick them → Create pickup), not from here (owner, 14 Nov).
 */
export default function PickupParcelList({ group }: PickupParcelListProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.pickupDrawer)
  const fmt = useFormat()

  // Helpers
  const kg = (grams: number | null) =>
    grams ? copy.weight(fmt.number(Math.round(grams / 10) / 100)) : null

  // Render logic
  const parcels = group.parcels.filter((p) => p.anchor)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
        {copy.parcels(parcels.length)}
      </p>
      <ul className="flex flex-col">
        {parcels.map((p) => (
          <li key={p.shipmentId} className="flex min-w-0 flex-col py-1.5">
            <span className="truncate text-body font-medium text-ink-strong">
              {copy.parcelTitle(p.orderNumber, p.waybill)}
            </span>
            <span className="truncate text-caption text-muted-foreground">
              {[p.customerName, p.city, kg(p.weightGrams)].filter(Boolean).join(' · ')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
