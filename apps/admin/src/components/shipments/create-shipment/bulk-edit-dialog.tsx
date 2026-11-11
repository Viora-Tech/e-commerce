'use client'

import type { CourierRateRow } from '@commerce/core'
import { ChevronLeftIcon, ChevronRightIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogFooter, DialogTitle } from '@commerce/ui/shadcn/dialog'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import { batchPosition } from './bulk-edit-state'
import CourierOption from './courier-option'
import { useChoiceForOrder } from './use-choice-for-order'

export type BulkEditOrder = {
  orderId: string
  orderNumber: number
  /** The order's couriers, as quoted for the batch's box. */
  options: CourierRateRow[]
  /** The option it books with now. */
  pickedKey: string | null
}

type BulkEditDialogProps = {
  orders: BulkEditOrder[]
  /** The order open now; null closes the popup. */
  orderId: string | null
  onOrderChange: (orderId: string | null) => void
  onSave: (orderId: string, optionKey: string) => void
}

/**
 * One order of a bulk batch (Figma 913:9698): its couriers to pick from, with ‹ › to move
 * through the batch without closing. Save and next keeps the pick and opens the next order.
 */
export default function BulkEditDialog({
  orders,
  orderId,
  onOrderChange,
  onSave,
}: BulkEditDialogProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.bulkEdit)
  const [choice, setChoice] = useChoiceForOrder(
    orderId,
    batchPosition(orders, orderId).order?.pickedKey ?? null,
  )

  // Helpers
  const go = (to: number) => {
    const next = orders[to]
    if (next) onOrderChange(next.orderId)
  }

  // Event handlers
  const handleSave = (andNext: boolean) => {
    const { index, order } = batchPosition(orders, orderId)
    if (order && choice) onSave(order.orderId, choice)
    if (andNext && index < orders.length - 1) go(index + 1)
    else onOrderChange(null)
  }

  // Render logic
  const { index, order } = batchPosition(orders, orderId)
  const bookable = order?.options ?? []

  return (
    <Dialog open={order !== undefined} onOpenChange={(open) => !open && onOrderChange(null)}>
      <DialogContent size="wide">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="flex-1">
              {order ? copy.title(order.orderNumber) : ''}
            </DialogTitle>
            <span className="text-caption text-muted-foreground tabular-nums">
              {copy.position(index + 1, orders.length)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={copy.previous}
              disabled={index <= 0}
              onClick={() => go(index - 1)}
            >
              <ChevronLeftIcon aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={copy.next}
              disabled={index >= orders.length - 1}
              onClick={() => go(index + 1)}
            >
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <p className="text-body font-medium text-ink-strong">{copy.courier}</p>
          {bookable.length === 0 ? (
            <p className="text-body text-danger">{copy.noCourier}</p>
          ) : (
            bookable.map((row) => (
              <CourierOption
                key={row.optionKey}
                row={row}
                selected={row.optionKey === choice}
                onSelect={() => setChoice(row.optionKey)}
              />
            ))
          )}
          <p className="text-caption text-muted-foreground">{copy.note}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleSave(false)} disabled={!choice}>
            {copy.save}
          </Button>
          <Button onClick={() => handleSave(true)} disabled={!choice}>
            {copy.saveNext}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
