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
import { pickupReady, startingPickupPlan } from './pickup-plan'

type PickupFormProps = {
  /** The parcels just booked; each courier is asked for its own. */
  shipmentIds: string[]
  /** After the courier took the request (the details view reads the shipment again). */
  onRequested?: (date: string) => void
}

/** Ask the courier to come and collect, without leaving the page: after booking, or again from
 *  a shipment's details when the first request was refused. One request per pickup location
 *  and day; a parcel booked later that day joins the open one. */
export default function PickupForm({ shipmentIds, onRequested }: PickupFormProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.pickup)
  const [plan, setPlan] = useState(() => startingPickupPlan())
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  // Event handlers
  const handleSchedule = async () => {
    setBusy(true)
    try {
      const pickups = await api.shipments.schedulePickup({
        shipmentIds,
        date: plan.date,
        timeFrom: plan.timeFrom,
      })
      // A refusal is recorded, not thrown: read it so "requested" is never said falsely.
      const refused = pickups.find((p) => p.status === 'failed')
      if (refused) {
        toast.error(refused.error || copy.notSupported)
        return
      }
      setDone(true)
      toast.success(copy.scheduled)
      onRequested?.(plan.date)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.notSupported)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const ready = shipmentIds.length > 0 && pickupReady(plan) && !busy && !done

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
            value={plan.date}
            disabled={done}
            onChange={(e) => setPlan({ ...plan, date: e.target.value })}
          />
        </Field>
        <Field className="w-auto">
          <FieldLabel htmlFor="pickup-from">{copy.from}</FieldLabel>
          <Input
            id="pickup-from"
            className="w-28"
            value={plan.timeFrom}
            disabled={done}
            onChange={(e) => setPlan({ ...plan, timeFrom: e.target.value })}
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
