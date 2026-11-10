'use client'

import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import DateField from '@/components/fields/date-field'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { createShipmentContent } from '@/data/create-shipment'
import { shipmentActionsContent } from '@/data/shipments'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type PickupNowDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The booked shipments; one pickup per courier and place is made (or joined). */
  shipmentIds: string[]
  onDone: () => void
}

/** Tomorrow in the browser's calendar, as YYYY-MM-DD. */
const tomorrow = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Create pickup right after booking (Figma 905:8280): day and time, then the courier's pickup
 * request and its manifest in one go, as on Shipments › Booked. The server joins a pickup that
 * is already open for the same place and day instead of asking twice (Figma 906:8464).
 */
export default function PickupNowDialog({
  open,
  onOpenChange,
  shipmentIds,
  onDone,
}: PickupNowDialogProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.drawer)
  const actions = useCopy(shipmentActionsContent)
  const [date, setDate] = useState(tomorrow)
  const [timeFrom, setTimeFrom] = useState('14:00')
  const [timeTo, setTimeTo] = useState('')

  // Event handlers
  const handleConfirm = async () => {
    try {
      const pickups = await api.shipments.schedulePickup({
        shipmentIds,
        date,
        timeFrom,
        timeTo: timeTo || undefined,
      })
      for (const p of pickups) {
        if (p.status === 'failed') continue
        await api.shipments.createManifest({ pickupId: p.id }).catch(() => undefined)
      }
      toast.success(copy.pickupDone)
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : actions.failed)
      throw err
    }
  }

  // Render logic
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.pickupTitle}
      body={copy.pickupBody}
      confirmLabel={copy.pickupTitle}
      tone="default"
      confirmDisabled={!date || !timeFrom}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="now-pickup-date">{actions.date}</FieldLabel>
          <DateField id="now-pickup-date" value={date} onChange={(v) => setDate(v)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="now-pickup-from">{actions.timeFrom}</FieldLabel>
            <Input
              id="now-pickup-from"
              value={timeFrom}
              onChange={(e) => setTimeFrom(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="now-pickup-to">{actions.timeTo}</FieldLabel>
            <Input id="now-pickup-to" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} />
          </Field>
        </div>
      </div>
    </ConfirmDialog>
  )
}
