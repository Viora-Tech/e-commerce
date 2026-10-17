'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@commerce/ui/shadcn/dialog'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import { type ShipmentDraft, STORE_ADDRESS } from './flow-state'

type ChangePickupDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  places: ShipmentDraft['pickupPlaces']
  /** A location id, or null for Settings › Shipping's address. */
  value: string | null
  onChange: (locationId: string | null) => void
}

/** Where the courier collects the parcel from: the pickup place select, behind "Change". */
export default function ChangePickupDialog({
  open,
  onOpenChange,
  places,
  value,
  onChange,
}: ChangePickupDialogProps) {
  // Hooks
  const copy = useCopy(createShipmentContent)

  // Event handlers
  const handleChange = (next: string) => {
    onChange(next === STORE_ADDRESS ? null : next)
    onOpenChange(false)
  }

  // Render logic
  const options = places.map((p) => {
    const where = copy.package.place(p.name, p.city, p.pincode)
    return {
      value: p.id ?? STORE_ADDRESS,
      label: p.id ? where : copy.package.storeAddress(where),
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.page.changePickup}</DialogTitle>
        </DialogHeader>
        <ChoiceField
          id="ship-pickup"
          label={copy.package.pickup}
          help={copy.package.pickupHelp}
          value={value ?? STORE_ADDRESS}
          options={options}
          onChange={handleChange}
        />
      </DialogContent>
    </Dialog>
  )
}
