'use client'

import { inventoryContent, type ManualReasonValue } from '@/data/inventory'
import InventoryTiles, { type InventoryStats } from './inventory-tiles'
import LocationSelect, { type StoreLocation } from './location-select'
import ReasonSelect from './reason-select'

type InventoryStripProps = {
  locations: StoreLocation[]
  locationId: string
  onLocationChange: (locationId: string) => void
  /** Hidden for members who can only read stock. */
  reason: ManualReasonValue | null
  onReasonChange: (reason: ManualReasonValue) => void
  stats: InventoryStats
}

const copy = inventoryContent

/** Location picker, the reason inline edits are logged with, then the stat tiles. */
export default function InventoryStrip({
  locations,
  locationId,
  onLocationChange,
  reason,
  onReasonChange,
  stats,
}: InventoryStripProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="inventory-location" className="text-kit-body text-muted-foreground">
          {copy.location}
        </label>
        <LocationSelect
          id="inventory-location"
          locations={locations}
          value={locationId}
          onChange={onLocationChange}
          className="min-w-56 bg-card"
        />
        {reason ? (
          <>
            <label
              htmlFor="inventory-reason"
              className="ml-auto text-kit-body text-muted-foreground"
            >
              {copy.reason}
            </label>
            <ReasonSelect
              id="inventory-reason"
              value={reason}
              onChange={onReasonChange}
              className="min-w-44 bg-card"
            />
          </>
        ) : null}
      </div>
      <InventoryTiles stats={stats} />
    </div>
  )
}
