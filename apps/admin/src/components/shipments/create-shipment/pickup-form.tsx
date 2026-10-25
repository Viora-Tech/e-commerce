'use client'

import { Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { todayKey } from '@/lib/format-date'

type PickupFormProps = {
  /** The parcels just booked; each courier is asked for its own. */
  shipmentIds: string[]
}

const TIME = /^\d{1,2}:\d{2}$/

/** After booking: ask the courier to come and collect, without leaving the flow. */
export default function PickupForm({ shipmentIds }: PickupFormProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.pickup)
  const [date, setDate] = useState(() => todayKey())
  const [timeFrom, setTimeFrom] = useState('14:00')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  // Event handlers
  const handleSchedule = async () => {
    setBusy(true)
    try {
      await api.shipments.schedulePickup({ shipmentIds, date, timeFrom })
      setDone(true)
      toast.success(copy.scheduled)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.notSupported)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const ready = shipmentIds.length > 0 && date !== '' && TIME.test(timeFrom) && !busy && !done

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-hairline p-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-body font-medium text-ink-strong">{copy.heading}</p>
        <p className="text-caption text-muted-foreground">{done ? copy.scheduled : copy.help}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field className="w-auto">
          <FieldLabel htmlFor="pickup-date">{copy.date}</FieldLabel>
          <Input
            id="pickup-date"
            type="date"
            value={date}
            disabled={done}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field className="w-auto">
          <FieldLabel htmlFor="pickup-from">{copy.from}</FieldLabel>
          <Input
            id="pickup-from"
            className="w-28"
            value={timeFrom}
            disabled={done}
            onChange={(e) => setTimeFrom(e.target.value)}
          />
        </Field>
        <Button variant="outline" onClick={handleSchedule} disabled={!ready}>
          <Truck aria-hidden />
          {busy ? copy.scheduling : copy.schedule}
        </Button>
      </div>
    </section>
  )
}
