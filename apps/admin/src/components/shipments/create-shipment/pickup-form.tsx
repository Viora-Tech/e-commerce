'use client'

import { Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import PickupDrawer from './pickup-drawer'

type PickupFormProps = {
  /** The parcels just booked; each courier is asked for its own. */
  shipmentIds: string[]
  /** After the courier took the request (the details view reads the shipment again). */
  onRequested?: (date: string) => void
}

/** Ask the courier to come and collect, without leaving the page: from a shipment's details when
 *  no pickup was made yet, or the first request was refused. Schedule pickup opens the Create
 *  pickup drawer (Figma 905:8280): one request per pickup location and day, and a parcel booked
 *  later that day joins the open one (Figma 906:8464). */
export default function PickupForm({ shipmentIds, onRequested }: PickupFormProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.pickup)
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)

  // Event handlers
  const handleDone = (date: string) => {
    setDone(true)
    onRequested?.(date)
  }

  // Render logic
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline p-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-body font-medium text-ink-strong">{copy.heading}</p>
        <p className="text-caption text-muted-foreground">{done ? copy.scheduled : copy.help}</p>
      </div>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={done || shipmentIds.length === 0}
      >
        <Truck aria-hidden />
        {copy.schedule}
      </Button>
      <PickupDrawer
        open={open}
        onOpenChange={setOpen}
        shipmentIds={shipmentIds}
        onDone={handleDone}
      />
    </section>
  )
}
