'use client'

import PickupDrawer from './pickup-drawer'

type PickupNowDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The booked shipments; one pickup per courier and place is made (or joined). */
  shipmentIds: string[]
  /** Kept for callers: the drawer reads each parcel's own courier from the server. */
  providerId?: string | undefined
  onDone: (date: string) => void
}

/**
 * Create pickup right after booking: opens the Create pickup drawer (Figma 905:8280), which
 * books the courier's pickup request and its manifest in one go, or adds the parcels to the
 * pickup already booked for that place and day (Figma 906:8464).
 */
export default function PickupNowDialog({
  open,
  onOpenChange,
  shipmentIds,
  onDone,
}: PickupNowDialogProps) {
  // Render logic
  return (
    <PickupDrawer
      open={open}
      onOpenChange={onOpenChange}
      shipmentIds={shipmentIds}
      onDone={onDone}
    />
  )
}
