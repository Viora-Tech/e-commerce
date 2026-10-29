'use client'

import { ChevronsUpDown } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import StatusChip from '@/components/layout/status-chip'
import { inventoryContent, type ManualReasonValue } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'
import LocationSelect, { type StoreLocation } from './location-select'
import ReasonSelect from './reason-select'

type InventoryStripProps = {
  locations: StoreLocation[]
  locationId: string
  onLocationChange: (locationId: string) => void
  /** Hidden for members who can only read stock. */
  reason: ManualReasonValue | null
  onReasonChange: (reason: ManualReasonValue) => void
  /** One row per SKU, or one per product with its SKUs folded under it. */
  byProduct: boolean
  onByProductChange: (byProduct: boolean) => void
  /** Products view with something to fold: whether every product is open. Null hides the button. */
  allExpanded: boolean | null
  onExpandAll: (open: boolean) => void
}

/** Location picker, the reason inline edits are logged with, then the stat tiles. */
export default function InventoryStrip({
  locations,
  locationId,
  onLocationChange,
  reason,
  onReasonChange,
  byProduct,
  onByProductChange,
  allExpanded,
  onExpandAll,
}: InventoryStripProps) {
  // Hooks
  const copy = useCopy(inventoryContent)

  // Event handlers
  const handleGroupChange = (next: string[]) => {
    if (next[0]) onByProductChange(next[0] === 'products')
  }

  // Render logic
  const online = locations.find((l) => l.id === locationId)?.fulfilsOnlineOrders ?? false

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="inventory-location" className="text-caption text-muted-foreground">
          {copy.location}
        </label>
        <div className="flex items-center gap-4">
          <LocationSelect
            id="inventory-location"
            locations={locations}
            value={locationId}
            onChange={onLocationChange}
            className="w-75 max-w-full bg-card"
          />
          {online ? <StatusChip tone="info">{copy.defaultBadge}</StatusChip> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span id="inventory-group-label" className="text-caption text-muted-foreground">
            {copy.group.label}
          </span>
          <ToggleGroup
            aria-labelledby="inventory-group-label"
            value={[byProduct ? 'products' : 'skus']}
            onValueChange={handleGroupChange}
            variant="outline"
            spacing={0}
            className="bg-card"
          >
            <ToggleGroupItem value="skus">{copy.group.skus}</ToggleGroupItem>
            <ToggleGroupItem value="products">{copy.group.products}</ToggleGroupItem>
          </ToggleGroup>
        </div>
        {allExpanded !== null ? (
          <Button variant="outline" className="bg-card" onClick={() => onExpandAll(!allExpanded)}>
            <ChevronsUpDown strokeWidth={1.6} aria-hidden />
            {allExpanded ? copy.tree.collapseAll : copy.tree.expandAll}
          </Button>
        ) : null}
        {reason ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="inventory-reason" className="text-caption text-muted-foreground">
              {copy.reason}
            </label>
            <ReasonSelect
              id="inventory-reason"
              value={reason}
              onChange={onReasonChange}
              className="w-50 bg-card"
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
