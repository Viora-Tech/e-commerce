'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { FieldDescription } from '@commerce/ui/shadcn/field'
import { Label } from '@commerce/ui/shadcn/label'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { orderDetailContent } from '@/data/order-detail'
import { ordersContent } from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type MarkDeliveredDialogProps = {
  /** The order to mark; null keeps the dialog closed. */
  order: { id: string; number: number } | null
  onClose: () => void
  onDone: () => void
  /** For the dialog opened from an order row, so clicks inside it do not open the order. */
  stopPropagation?: boolean
}

/**
 * "Mark #n as delivered?" (owner, 11 Nov 2026): one confirm wherever Mark as delivered is
 * offered (More actions, the Next step card, the row menu), with "Notify customer" on by
 * default. The shopper's Delivered message cannot be recalled, so it is never one click.
 */
export default function MarkDeliveredDialog({
  order,
  onClose,
  onDone,
  stopPropagation = false,
}: MarkDeliveredDialogProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const list = useCopy(ordersContent)
  const [notify, setNotify] = useState(true)
  useEffect(() => {
    if (order) setNotify(true)
  }, [order])

  // Event handlers
  const handleConfirm = async () => {
    if (!order) return
    try {
      await api.orders.setStatus({ id: order.id, status: 'delivered', notifyCustomer: notify })
      toast.success(copy.delivered.done)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : list.bulk.failed)
      throw err
    }
  }

  return (
    <ConfirmDialog
      open={order !== null}
      onOpenChange={(open) => (!open ? onClose() : undefined)}
      title={order ? copy.delivered.title(order.number) : ''}
      body={copy.delivered.body}
      confirmLabel={copy.delivered.confirm}
      tone="default"
      stopPropagation={stopPropagation}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="delivered-notify" className="flex items-center gap-2 font-normal">
          <Checkbox
            id="delivered-notify"
            checked={notify}
            onCheckedChange={(v) => setNotify(v === true)}
          />
          {copy.delivered.notify}
        </Label>
        <FieldDescription>{copy.delivered.notifyHint}</FieldDescription>
      </div>
    </ConfirmDialog>
  )
}
