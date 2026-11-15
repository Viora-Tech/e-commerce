'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import { useEffect, useRef, useState } from 'react'
import StatusChip from '@/components/layout/status-chip'
import { bulkShipContent } from '@/data/bulk-ship'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import BulkEditPackage from './bulk-edit-package'
import BulkEditShipping from './bulk-edit-shipping'
import { editForm, formToEdit, repriced } from './bulk-edit-state'
import type { BulkLine, OrderEdit } from './bulk-ship-state'
import type { ShipmentDraft } from './flow-state'

type BulkEditInlineProps = {
  line: BulkLine
  edit: OrderEdit | undefined
  boxes: ShipmentDraft['boxes']
  /** Columns in the drawer's table, so the editor spans the whole row. */
  columns: number
  /** The merchant left this order out of the booking. */
  skipped: boolean
  /** Apply: the drawer stores the edit and, when the package or payment changed, re-quotes. */
  onApply: (edit: OrderEdit) => void
  /** Cancel (or Esc, handled by the drawer): nothing changes. */
  onCancel: () => void
  onSkip: (skip: boolean) => void
}

/**
 * Edit shipment (Figma 913:9698) in place: the order's row opens under itself, Shopify bulk
 * editor style, instead of a dialog over the drawer. Its items, box, weight and size on the
 * left; its courier (with the shopper's checkout choice), payment, insurance and charge on the
 * right. Apply keeps the changes (a changed package or payment asks its couriers again);
 * Cancel and Esc leave the row as it was. The panel is as wide as the visible table, so it
 * stays readable at phone width while the table itself scrolls sideways.
 */
export default function BulkEditInline({
  line,
  edit,
  boxes,
  columns,
  skipped,
  onApply,
  onCancel,
  onSkip,
}: BulkEditInlineProps) {
  // Hooks
  const copy = useCopy(bulkShipContent)
  const pkg = useCopy(createShipmentContent.package)
  const fmt = useFormat()
  const [form, setForm] = useState(() => editForm(line, edit, boxes))
  const panel = useRef<HTMLFieldSetElement>(null)

  // Opened: focus moves into the editor (and scrolls it into view).
  useEffect(() => {
    panel.current?.focus()
  }, [])

  // Event handlers
  const handleApply = () => onApply(formToEdit(form, line, edit))

  // Render logic
  const p = copy.editPopup
  const o = line.order
  const units = line.parcel?.lines.reduce((n, l) => n + l.quantity, 0) ?? 0
  const repricing = repriced(edit, formToEdit(form, line, edit))
  const titleId = `bulk-edit-title-${o.orderId}`
  const subtitle = p.subtitle([
    o.customerName ?? '',
    [o.city, o.pincode].filter(Boolean).join(' '),
    `${line.paymentMode === 'cod' ? copy.cod : copy.prepaid} ${fmt.money(line.parcel?.valuePaise ?? o.totalPaise)}`,
    pkg.itemCount(units),
  ])

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/30">
      <TableCell colSpan={columns} className="p-0">
        <fieldset
          ref={panel}
          aria-labelledby={titleId}
          tabIndex={-1}
          className="sticky left-0 flex w-[100cqw] min-w-0 flex-col gap-4 px-4 py-4 outline-none"
        >
          <div className="flex flex-col gap-1">
            <p
              id={titleId}
              className="flex flex-wrap items-center gap-2 text-body font-medium text-ink-strong"
            >
              {p.title(o.orderNumber)}
              {line.problem?.kind === 'needs_package' ? (
                <StatusChip tone="attention" variant="outline">
                  {copy.problem.needsPackage(line.problem.box)}
                </StatusChip>
              ) : null}
            </p>
            <p className="text-caption text-muted-foreground">{subtitle}</p>
          </div>
          <div className="grid gap-6 @3xl:grid-cols-2">
            <BulkEditPackage line={line} form={form} onChange={setForm} boxes={boxes} />
            <BulkEditShipping line={line} form={form} onChange={setForm} repricing={repricing} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <Button
              variant="ghost"
              onClick={() => onSkip(!skipped)}
              disabled={line.status !== 'ready'}
            >
              {skipped ? p.unskip : p.skip}
            </Button>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-caption text-muted-foreground">{p.applyNote}</span>
              <Button variant="outline" onClick={onCancel}>
                {p.cancel}
              </Button>
              <Button onClick={handleApply}>{p.apply}</Button>
            </div>
          </div>
        </fieldset>
      </TableCell>
    </TableRow>
  )
}
