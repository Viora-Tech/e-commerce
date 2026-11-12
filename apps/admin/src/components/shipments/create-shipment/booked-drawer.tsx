'use client'

import { XIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@commerce/ui/shadcn/drawer'
import StatusChip from '@/components/layout/status-chip'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import DoneStep, { type BookedShipment } from './done-step'

type BookedDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  booked: BookedShipment
  onCreatePickup: () => void
  backHref: string
}

/**
 * Figma 905:7783: the bottom drawer that opens over Create shipment once the parcel is booked.
 * "Booked with <courier>", then the Shipment and Next boxes (`DoneStep`).
 */
export default function BookedDrawer({
  open,
  onOpenChange,
  booked,
  onCreatePickup,
  backHref,
}: BookedDrawerProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.booked)

  // Render logic
  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent className="mx-auto max-h-[calc(100dvh-4rem)] max-w-[90rem]">
        <DrawerHeader className="flex flex-row items-start justify-between gap-4 px-4 pt-2 text-left md:px-8">
          <div className="flex min-w-0 flex-col items-start gap-1 text-left">
            <StatusChip tone="success">{copy.badge}</StatusChip>
            <DrawerTitle className="text-lg font-semibold text-ink-strong">
              {copy.title(booked.courier)}
            </DrawerTitle>
            <DrawerDescription className="text-body text-muted-foreground">
              {booked.labelUrl ? copy.body : copy.noLabelBody}
            </DrawerDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={copy.close}
            onClick={() => onOpenChange(false)}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 md:px-8">
          <DoneStep booked={booked} onCreatePickup={onCreatePickup} backHref={backHref} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
