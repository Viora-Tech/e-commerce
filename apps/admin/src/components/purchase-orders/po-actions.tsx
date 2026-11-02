'use client'

import { CircleCheck, PackageCheck, RotateCcw, Save, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { type PurchaseOrderStatus, purchaseOrderFormContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'
import PoMoreMenu from './po-more-menu'

type PoActionsProps = {
  /** Null while the order is being created. */
  status: PurchaseOrderStatus | null
  busy: boolean
  /** Nothing has arrived yet, so the order can still be called off. */
  cancellable: boolean
  /** A closed order with units still outstanding, or a cancelled one. */
  reopenable: boolean
  onSave: () => void
  onMarkOrdered: () => void
  onReceive: () => void
  onClose: () => void
  onCancel: () => void
  onReopen: () => void
  onDelete: () => void
  onPrint: () => void
  onDownload: () => void
  onEmail: () => void
  onDuplicate: () => void
}

/**
 * Header buttons for each stage: draft, ordered and receiving, then reopen once finished.
 * A saved order that is not cancelled also gets a menu to print, download or email its PDF.
 */
export default function PoActions({
  status,
  busy,
  cancellable,
  reopenable,
  onSave,
  onMarkOrdered,
  onReceive,
  onClose,
  onCancel,
  onReopen,
  onDelete,
  onPrint,
  onDownload,
  onEmail,
  onDuplicate,
}: PoActionsProps) {
  // Hooks
  const copy = useCopy(purchaseOrderFormContent)

  // Early returns
  const menu =
    status === null || status === 'cancelled' ? null : (
      <PoMoreMenu
        busy={busy}
        onPrint={onPrint}
        onDownload={onDownload}
        onEmail={onEmail}
        onDuplicate={onDuplicate}
      />
    )
  if (status === 'received' || status === 'closed' || status === 'cancelled') {
    return (
      <>
        {menu}
        {status === 'cancelled' ? (
          <Button variant="outline" onClick={onDelete} disabled={busy}>
            <Trash2 aria-hidden="true" />
            {copy.delete}
          </Button>
        ) : null}
        {reopenable ? (
          <Button variant="outline" onClick={onReopen} disabled={busy}>
            <RotateCcw aria-hidden="true" />
            {copy.reopen}
          </Button>
        ) : null}
      </>
    )
  }

  // Render logic
  const receiving = status === 'ordered' || status === 'partially_received'

  return receiving ? (
    <>
      {menu}
      {cancellable ? (
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          {copy.cancel}
        </Button>
      ) : (
        <Button variant="outline" onClick={onClose} disabled={busy}>
          {copy.close}
        </Button>
      )}
      <Button onClick={onReceive} disabled={busy}>
        <PackageCheck aria-hidden="true" />
        {copy.receive}
      </Button>
    </>
  ) : (
    <>
      {menu}
      {status === 'draft' ? (
        <Button variant="outline" onClick={onDelete} disabled={busy}>
          <Trash2 aria-hidden="true" />
          {copy.delete}
        </Button>
      ) : null}
      <Button variant="outline" onClick={onSave} disabled={busy}>
        <Save aria-hidden="true" />
        {busy ? copy.saving : copy.save}
      </Button>
      <Button onClick={onMarkOrdered} disabled={busy}>
        <CircleCheck aria-hidden="true" />
        {copy.markOrdered}
      </Button>
    </>
  )
}
