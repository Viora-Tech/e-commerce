'use client'

import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { shipmentActionsContent, shipmentCancelContent } from '@/data/shipments'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'

type Choice = 'back' | 'shipment' | 'sendBack' | 'marked'

type ShipmentCancelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shipmentId: string
  waybill: string
  /** Shipment status: `created` (at the store) or picked up / in transit / out for delivery. */
  status: string
  /** On a pickup (To be picked up): "Cancel pickup" is offered. */
  onPickup: boolean
  /** The courier takes cancellations over its API; without it only the no-courier ways are open. */
  courierCancels: boolean
  onDone: () => void
}

type OptionProps = {
  id: string
  value: Choice
  label: string
  help: string
  disabled?: boolean
}

function Option({ id, value, label, help, disabled }: OptionProps) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-3 rounded-md border p-3 has-[[data-state=checked]]:border-primary has-[:disabled]:opacity-60"
    >
      <RadioGroupItem id={id} value={value} disabled={disabled} className="mt-0.5" />
      <span className="flex flex-col gap-0.5">
        <span className="text-body font-medium">{label}</span>
        <span className="text-caption text-muted-foreground">{help}</span>
      </span>
    </label>
  )
}

/** The choices that fit where the parcel is (owner, 18 Nov 2026). */
function choicesFor(status: string, onPickup: boolean): Choice[] {
  if (status !== 'created') return ['sendBack', 'marked']
  return onPickup ? ['back', 'shipment', 'marked'] : ['shipment', 'marked']
}

/** Whether a choice asks the courier (and so needs its cancel API). */
const ASKS_COURIER: ReadonlySet<Choice> = new Set(['shipment', 'sendBack'])

/**
 * The Cancel popup on a booked parcel, from Booked, To be picked up and In transit. At the store:
 * cancel the pickup (back to Booked, label kept) or the shipment (AWB cancelled, back to To ship,
 * items stay packed). Picked up: cancel and bring it back (RTO). Always: it was already cancelled
 * on the courier's own app, so it is only recorded here.
 */
export default function ShipmentCancelDialog({
  open,
  onOpenChange,
  shipmentId,
  waybill,
  status,
  onPickup,
  courierCancels,
  onDone,
}: ShipmentCancelDialogProps) {
  // Hooks
  const copy = useCopy(shipmentCancelContent)
  const actions = useCopy(shipmentActionsContent)
  const choices = choicesFor(status, onPickup)
  const [choice, setChoice] = useState<Choice>(
    () => choices.find((c) => courierCancels || !ASKS_COURIER.has(c)) ?? 'marked',
  )

  // Event handlers
  const handleConfirm = async () => {
    try {
      if (choice === 'back') {
        await api.orders.returnShipmentToBooked({ shipmentId })
        toast.success(copy.backDone)
      } else if (choice === 'shipment') {
        await api.orders.cancelShipment({ shipmentId, keepPacked: true })
        toast.success(copy.shipmentDone)
      } else if (choice === 'sendBack') {
        await api.orders.sendBackShipment({ shipmentId })
        toast.success(copy.sendBackDone)
      } else {
        await api.orders.markShipmentCancelled({ shipmentId })
        toast.success(copy.markedDone)
      }
      onDone()
    } catch (err) {
      toast.error(errorText(err, actions.failed))
      throw err
    }
  }

  // Render logic
  const prefix = `cancel-${shipmentId}`
  const labels: Record<Choice, [string, string]> = {
    back: [copy.back, copy.backHelp],
    shipment: [copy.shipment, copy.shipmentHelp],
    sendBack: [copy.sendBack, copy.sendBackHelp],
    marked: [copy.marked, copy.markedHelp],
  }

  return (
    <ConfirmDialog
      tone={choice === 'back' ? 'default' : 'destructive'}
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title(waybill)}
      confirmLabel={copy.confirm}
      cancelLabel={copy.keep}
      stopPropagation
      onConfirm={handleConfirm}
    >
      <RadioGroup value={choice} onValueChange={(v) => setChoice(v as Choice)} className="gap-2">
        {choices.map((c) => {
          const blocked = ASKS_COURIER.has(c) && !courierCancels
          return (
            <Option
              key={c}
              id={`${prefix}-${c}`}
              value={c}
              label={labels[c][0]}
              help={blocked ? copy.noCourierCancel : labels[c][1]}
              disabled={blocked}
            />
          )
        })}
      </RadioGroup>
    </ConfirmDialog>
  )
}
