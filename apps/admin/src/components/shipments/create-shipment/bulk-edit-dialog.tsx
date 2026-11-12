'use client'

import { ChevronLeftIcon, ChevronRightIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '@commerce/ui/shadcn/dialog'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import StatusChip from '@/components/layout/status-chip'
import { bulkShipContent } from '@/data/bulk-ship'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import BulkEditPackage from './bulk-edit-package'
import BulkEditShipping from './bulk-edit-shipping'
import { editForm, formToEdit, linePosition, repriced } from './bulk-edit-state'
import type { BulkLine, OrderEdit } from './bulk-ship-state'
import type { ShipmentDraft } from './flow-state'
import { useChoiceForOrder } from './use-choice-for-order'

type BulkEditDialogProps = {
  lines: BulkLine[]
  /** The order open now; null closes the popup. */
  orderId: string | null
  onOrderChange: (orderId: string | null) => void
  edits: Readonly<Record<string, OrderEdit>>
  boxes: ShipmentDraft['boxes']
  /** Orders the merchant left out of this booking. */
  unticked: ReadonlySet<string>
  onSave: (orderId: string, edit: OrderEdit) => void
  onSkip: (orderId: string, skip: boolean) => void
}

/**
 * Edit shipment (Figma 913:9698): one order of the bulk batch over the drawer. Its items, box,
 * weight and size on the left; its courier (with what the shopper chose at checkout), payment,
 * insurance and charge on the right. ‹ › move through the batch; Save and next keeps the
 * changes and opens the next order. A changed package or payment asks its couriers again.
 */
export default function BulkEditDialog({
  lines,
  orderId,
  onOrderChange,
  edits,
  boxes,
  unticked,
  onSave,
  onSkip,
}: BulkEditDialogProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.bulkEdit)
  const bulk = useCopy(bulkShipContent)
  const pkg = useCopy(createShipmentContent.package)
  const fmt = useFormat()
  const [form, setForm] = useChoiceForOrder(orderId, () => {
    const open = linePosition(lines, orderId).line
    return open && orderId ? editForm(open, edits[orderId], boxes) : null
  })

  // Helpers
  const go = (to: number) => {
    const next = lines[to]
    if (next) onOrderChange(next.order.orderId)
  }

  // Event handlers
  const handleSave = (andNext: boolean) => {
    const { index, line: open } = linePosition(lines, orderId)
    if (open && form) {
      const id = open.order.orderId
      onSave(id, formToEdit(form, open, edits[id]))
    }
    if (andNext && index < lines.length - 1) go(index + 1)
    else onOrderChange(null)
  }
  const handleSkip = () => {
    const { index, line: open } = linePosition(lines, orderId)
    if (!open) return
    onSkip(open.order.orderId, !unticked.has(open.order.orderId))
    if (index < lines.length - 1) go(index + 1)
    else onOrderChange(null)
  }

  // Render logic
  const { index, line } = linePosition(lines, orderId)
  const orders = lines
  const o = line?.order
  const p = bulk.editPopup
  const units = line?.parcel?.lines.reduce((n, l) => n + l.quantity, 0) ?? 0
  const repricing =
    !!line &&
    !!form &&
    repriced(edits[line.order.orderId], formToEdit(form, line, edits[line.order.orderId]))
  const skipped = line ? unticked.has(line.order.orderId) : false
  const subtitle = o
    ? p.subtitle([
        o.customerName ?? '',
        [o.city, o.pincode].filter(Boolean).join(' '),
        `${line?.paymentMode === 'cod' ? bulk.cod : bulk.prepaid} ${fmt.money(line?.parcel?.valuePaise ?? o.totalPaise)}`,
        pkg.itemCount(units),
      ])
    : ''

  return (
    <Dialog open={line !== undefined} onOpenChange={(open) => !open && onOrderChange(null)}>
      <DialogContent size="wide">
        <DialogHeader>
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {o ? copy.title(o.orderNumber) : ''}
                {line?.problem?.kind === 'needs_package' ? (
                  <StatusChip tone="attention" variant="outline">
                    {bulk.problem.needsPackage(line.problem.box)}
                  </StatusChip>
                ) : null}
              </DialogTitle>
              <DialogDescription>{subtitle}</DialogDescription>
            </div>
            <span className="pt-1 text-caption text-muted-foreground tabular-nums">
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
        {line && form ? (
          <div className="grid gap-6 md:grid-cols-2">
            <BulkEditPackage line={line} form={form} onChange={setForm} boxes={boxes} />
            <BulkEditShipping line={line} form={form} onChange={setForm} repricing={repricing} />
          </div>
        ) : null}
        <DialogFooter className="items-center sm:justify-between">
          <Button variant="ghost" onClick={handleSkip} disabled={line?.status !== 'ready'}>
            {skipped ? p.unskip : p.skip}
          </Button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-caption text-muted-foreground">{p.saveNote}</span>
            <Button variant="outline" onClick={() => handleSave(false)} disabled={!form}>
              {copy.save}
            </Button>
            <Button onClick={() => handleSave(true)} disabled={!form}>
              {copy.saveNext}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
