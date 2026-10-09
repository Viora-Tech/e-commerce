'use client'

import { inventoryContent, type ManualReasonValue } from '@/data/inventory'
import LocationSelect, { type StoreLocation } from './location-select'
import ReasonSelect from './reason-select'

type InventoryStripProps = {
  locations: StoreLocation[]
  locationId: string
  onLocationChange: (locationId: string) => void
  /** Hidden for members who can only read stock. */
  reason: ManualReasonValue | null
  onReasonChange: (reason: ManualReasonValue) => void
}

const copy = inventoryContent

/** Location picker, the reason inline edits are logged with, then the stat tiles. */
export default function InventoryStrip({
  locations,
  locationId,
  onLocationChange,
  reason,
  onReasonChange,
}: InventoryStripProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="inventory-location" className="text-caption text-muted-foreground">
          {copy.location}
        </label>
        <LocationSelect
          id="inventory-location"
          locations={locations}
          value={locationId}
          onChange={onLocationChange}
          className="min-w-44 bg-card"
        />
      </div>
      {reason ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="inventory-reason" className="text-caption text-muted-foreground">
            {copy.reason}
          </label>
          <ReasonSelect
            id="inventory-reason"
            value={reason}
            onChange={onReasonChange}
            className="min-w-44 bg-card"
          />
        </div>
      ) : null}
    </div>
  )
}
