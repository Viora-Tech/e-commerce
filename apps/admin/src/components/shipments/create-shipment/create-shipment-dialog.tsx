'use client'

import { Dialog, DialogContent, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import BulkShipmentFlow from './bulk-shipment-flow'
import type { ShipmentDraft } from './flow-state'
import SingleShipmentFlow from './single-shipment-flow'

type CreateShipmentDialogProps = {
  /** The orders to ship; the dialog is open while there are any. One order is the full flow,
   *  several are the bulk flow. */
  orderIds: string[]
  /** A courier's provider id to start the bulk flow on (a courier app's Create shipment). */
  courier?: string | undefined
  onClose: () => void
  /** After a booking, so the page behind reloads (order status, Shipments tabs). */
  onBooked: () => void
}

/**
 * Create shipment: the one flow every "Ship" button in the admin opens (order page, Orders →
 * Shipments, book by order number, bulk). Package → Courier (every connected courier with its
 * live rate, or ship it yourself) → Review → Booked (AWB, label, pickup).
 */
export default function CreateShipmentDialog({
  orderIds,
  courier,
  onClose,
  onBooked,
}: CreateShipmentDialogProps) {
  // Hooks
  const copy = useCopy(createShipmentContent)
  const [draft, setDraft] = useState<ShipmentDraft | null>(null)
  const [failed, setFailed] = useState(false)
  // A fresh draft each time the dialog opens for a new set of orders.
  useEffect(() => {
    if (orderIds.length === 0) return
    let live = true
    setDraft(null)
    setFailed(false)
    api.shipments
      .prepare({ orderIds })
      .then((d) => live && setDraft(d))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [orderIds])

  // Render logic
  const open = orderIds.length > 0
  const single = orderIds.length === 1 ? draft?.orders[0] : undefined
  const key = orderIds.join(',')

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-2xl">
        {!draft ? (
          <>
            <DialogTitle className="sr-only">{copy.bulkTitle(orderIds.length)}</DialogTitle>
            <p className="flex items-center gap-2 py-8 text-body text-muted-foreground">
              {failed ? null : <Spinner />}
              {failed ? copy.loadFailed : copy.loading}
            </p>
          </>
        ) : single ? (
          <SingleShipmentFlow
            key={key}
            draft={draft}
            order={single}
            onClose={onClose}
            onBooked={onBooked}
          />
        ) : (
          <BulkShipmentFlow
            key={key}
            draft={draft}
            courier={courier}
            onClose={onClose}
            onBooked={onBooked}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
