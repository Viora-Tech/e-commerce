'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { inventoryContent } from '@/data/inventory'
import type { api } from '@/lib/api-client'

export type StoreLocation = Awaited<ReturnType<typeof api.inventory.locations>>[number]

type LocationSelectProps = {
  id: string
  locations: StoreLocation[]
  value: string
  onChange: (locationId: string) => void
  className?: string
  disabled?: boolean
}

/** Picks one of the store's locations; the online-orders one is marked. */
export default function LocationSelect({
  id,
  locations,
  value,
  onChange,
  className,
  disabled,
}: LocationSelectProps) {
  // Render logic
  const items = Object.fromEntries(locations.map((l) => [l.id, l.name]))

  return (
    <Select
      items={items}
      value={value}
      disabled={disabled}
      onValueChange={(next) => onChange(String(next))}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locations.map((l) => (
          <SelectItem key={l.id} value={l.id}>
            <span className="flex items-center gap-2">
              {l.name}
              {l.fulfilsOnlineOrders ? (
                <span className="text-caption text-muted-foreground">
                  {inventoryContent.defaultBadge}
                </span>
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
