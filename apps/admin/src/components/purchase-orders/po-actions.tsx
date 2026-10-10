'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { type PurchaseOrderStatus, purchaseOrderFormContent } from '@/data/inventory'

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
}

const copy = purchaseOrderFormContent

/** Header buttons for each stage: draft, ordered and receiving, then reopen once finished. */
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
}: PoActionsProps) {
  // Early returns
  if (status === 'received' || status === 'closed' || status === 'cancelled') {
    return (
      <>
        {status === 'cancelled' ? (
          <Button variant="outline" onClick={onDelete} disabled={busy}>
            {copy.delete}
          </Button>
        ) : null}
        {reopenable ? (
          <Button variant="outline" onClick={onReopen} disabled={busy}>
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
        {copy.receive}
      </Button>
    </>
  ) : (
    <>
      {status === 'draft' ? (
        <Button variant="outline" onClick={onDelete} disabled={busy}>
          {copy.delete}
        </Button>
      ) : null}
      <Button variant="outline" onClick={onSave} disabled={busy}>
        {busy ? copy.saving : copy.save}
      </Button>
      <Button onClick={onMarkOrdered} disabled={busy}>
        {copy.markOrdered}
      </Button>
    </>
  )
}
