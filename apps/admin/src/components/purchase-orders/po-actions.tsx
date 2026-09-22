'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { type PurchaseOrderStatus, purchaseOrderFormContent } from '@/data/inventory'

type PoActionsProps = {
  /** Null while the order is being created. */
  status: PurchaseOrderStatus | null
  busy: boolean
  onSave: () => void
  onMarkOrdered: () => void
  onReceive: () => void
  onClose: () => void
  onDelete: () => void
}

const copy = purchaseOrderFormContent

/** Header buttons for each stage: draft, ordered and receiving, then nothing once finished. */
export default function PoActions({
  status,
  busy,
  onSave,
  onMarkOrdered,
  onReceive,
  onClose,
  onDelete,
}: PoActionsProps) {
  // Early returns
  if (status === 'received' || status === 'closed') return null

  // Render logic
  const receiving = status === 'ordered' || status === 'partially_received'

  return receiving ? (
    <>
      <Button variant="outline" onClick={onClose} disabled={busy}>
        {copy.close}
      </Button>
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
