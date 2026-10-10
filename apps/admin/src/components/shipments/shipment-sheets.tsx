'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@commerce/ui/shadcn/sheet'
import { shipmentsContent } from '@/data/shipments'
import { useCopy } from '@/hooks/use-copy'
import BookShipmentsPanel from './book-shipments-panel'
import NdrTab from './ndr-tab'
import PickupsTab from './pickups-tab'

export type SheetKind = 'pickups' | 'ndr' | 'byNumber'

type ShipmentSheetsProps = {
  open: SheetKind | null
  onClose: () => void
  /** A booking from "Book by order number", so the page refreshes its counts. */
  onBooked: () => void
}

/**
 * What sits beside the Shipments table rather than in a tab: pickups and manifests ("Pickups"
 * in the header), deliveries the courier could not make ("2 need attention" in the summary
 * line) and booking by order number (the header's ⋯ menu).
 */
export default function ShipmentSheets({ open, onClose, onBooked }: ShipmentSheetsProps) {
  // Hooks
  const copy = useCopy(shipmentsContent)

  // Render logic
  const head =
    open === 'ndr' ? copy.ndrSheet : open === 'byNumber' ? copy.byNumberSheet : copy.pickupsSheet

  return (
    <Sheet open={open !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader className="border-line border-b">
          <SheetTitle>{head.title}</SheetTitle>
          <SheetDescription>{head.body}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {open === 'ndr' ? <NdrTab /> : null}
          {open === 'pickups' ? <PickupsTab /> : null}
          {open === 'byNumber' ? <BookShipmentsPanel onBooked={onBooked} /> : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
