'use client'

import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { shipmentActionsContent, shipmentCancelContent } from '@/data/shipments'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Choice = 'back' | 'shipment' | 'fulfilment'

type ShipmentCancelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shipmentId: string
  waybill: string
  /** On a pickup (To be picked up): "Move back to Booked" is offered. */
  onPickup: boolean
  /** The courier takes cancellations over its API; without it only "Move back" is possible. */
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

/**
 * The Cancel popup on a booked parcel still at the store (owner, 18 Nov 2026), from Booked and
 * To be picked up: move it back to Booked (off its pickup, label kept), cancel the shipment (the
 * AWB goes, items stay packed) or cancel the fulfilment (the AWB goes, items are unpacked).
 */
export default function ShipmentCancelDialog({
  open,
  onOpenChange,
  shipmentId,
  waybill,
  onPickup,
  courierCancels,
  onDone,
}: ShipmentCancelDialogProps) {
  // Hooks
  const copy = useCopy(shipmentCancelContent)
  const actions = useCopy(shipmentActionsContent)
  const [choice, setChoice] = useState<Choice>(onPickup ? 'back' : 'shipment')

  // Event handlers
  const handleConfirm = async () => {
    try {
      if (choice === 'back') {
        await api.orders.returnShipmentToBooked({ shipmentId })
        toast.success(copy.backDone)
      } else {
        await api.orders.cancelShipment({ shipmentId, keepPacked: choice === 'shipment' })
        toast.success(choice === 'shipment' ? copy.shipmentDone : copy.fulfilmentDone)
      }
      onDone()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : actions.failed)
      throw err
    }
  }

  // Render logic
  const prefix = `cancel-${shipmentId}`

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
        {onPickup ? (
          <Option id={`${prefix}-back`} value="back" label={copy.back} help={copy.backHelp} />
        ) : null}
        <Option
          id={`${prefix}-shipment`}
          value="shipment"
          label={copy.shipment}
          help={courierCancels ? copy.shipmentHelp : copy.noCourierCancel}
          disabled={!courierCancels}
        />
        <Option
          id={`${prefix}-fulfilment`}
          value="fulfilment"
          label={copy.fulfilment}
          help={courierCancels ? copy.fulfilmentHelp : copy.noCourierCancel}
          disabled={!courierCancels}
        />
      </RadioGroup>
    </ConfirmDialog>
  )
}
