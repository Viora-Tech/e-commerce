'use client'

import { CircleCheck, Package, Plus, Store } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import Link from 'next/link'
import { useState } from 'react'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import { addressLines } from '@/lib/address'
import { routes } from '@/lib/routes'
import type { ShipmentDraft } from './flow-state'

type ChangePickupDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  places: ShipmentDraft['pickupPlaces']
  /** A location id, or null for Settings › Shipping's address. */
  value: string | null
  onChange: (locationId: string | null) => void
}

/**
 * "Pick up from" behind Change (Figma 623:18048): each pickup place as a tile with its full
 * address, the default first; a link to add one; Use this address applies the pick.
 */
export default function ChangePickupDialog({
  open,
  onOpenChange,
  places,
  value,
  onChange,
}: ChangePickupDialogProps) {
  // Hooks
  const copy = useCopy(createShipmentContent)
  const [picked, setPicked] = useState<string | null>(value)

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (next) setPicked(value)
    onOpenChange(next)
  }

  const handleUse = () => {
    onChange(picked)
    onOpenChange(false)
  }

  // Render logic
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[32.5rem]">
        <DialogHeader>
          <DialogTitle>{copy.package.pickup}</DialogTitle>
          <DialogDescription>{copy.package.pickupDialogHelp}</DialogDescription>
        </DialogHeader>
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">{copy.package.pickup}</legend>
          {places.map((p) => {
            const selected = p.id === picked
            const Icon = p.id === null ? Store : Package
            const where = addressLines({
              line1: p.line1 ?? '',
              line2: p.line2,
              city: p.city ?? '',
              stateCode: p.stateCode ?? '',
              pincode: p.pincode,
              phone: null,
            }).join(', ')
            return (
              <button
                key={p.id ?? 'store'}
                type="button"
                aria-pressed={selected}
                onClick={() => setPicked(p.id)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected ? 'border-foreground' : 'border-border hover:bg-muted/60',
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body text-foreground">
                    {p.id === null ? copy.package.pickupDefault(p.name) : p.name}
                  </span>
                  <span className="truncate text-caption text-muted-foreground">{where}</span>
                </span>
                {selected ? (
                  <CircleCheck aria-hidden className="size-4 shrink-0 text-foreground" />
                ) : null}
              </button>
            )
          })}
          <Link
            href={routes.settings.locations()}
            className="flex items-center gap-2 self-start rounded-md px-3 py-1.5 text-body text-foreground hover:bg-muted"
          >
            <Plus aria-hidden className="size-4" />
            {copy.package.pickupAdd}
          </Link>
        </fieldset>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.package.pickupCancel}
          </Button>
          <Button onClick={handleUse}>{copy.package.pickupUse}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
