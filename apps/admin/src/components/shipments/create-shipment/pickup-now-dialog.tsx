'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { createShipmentContent } from '@/data/create-shipment'
import { shipmentActionsContent } from '@/data/shipments'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import PickupFields, { type PickupValue } from '../pickup-fields'

type PickupNowDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The booked shipments; one pickup per courier and place is made (or joined). */
  shipmentIds: string[]
  /** The booked courier: only its open pickups are offered to join. */
  providerId?: string | undefined
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
  providerId,
  onDone,
}: PickupNowDialogProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.drawer)
  const actions = useCopy(shipmentActionsContent)
  const [pickup, setPickup] = useState<PickupValue>(() => ({
    date: tomorrow(),
    timeFrom: '14:00',
    timeTo: '',
    joinPickupId: null,
  }))

  // Event handlers
  const handleConfirm = async () => {
    try {
      const pickups = await api.shipments.schedulePickup({
        shipmentIds,
        date: pickup.date,
        timeFrom: pickup.timeFrom,
        timeTo: pickup.timeTo || undefined,
        joinPickupId: pickup.joinPickupId ?? undefined,
      })
      for (const p of pickups) {
        if (p.status === 'failed') continue
        await api.shipments.createManifest({ pickupId: p.id }).catch(() => undefined)
      }
      toast.success(pickup.joinPickupId ? actions.joinedDone(shipmentIds.length) : copy.pickupDone)
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
      confirmLabel={pickup.joinPickupId ? actions.addToPickup : copy.pickupTitle}
      tone="default"
      confirmDisabled={!pickup.date || !pickup.timeFrom}
      onConfirm={handleConfirm}
    >
      <PickupFields
        idPrefix="now-pickup"
        providerId={providerId}
        value={pickup}
        onChange={setPickup}
      />
    </ConfirmDialog>
  )
}
