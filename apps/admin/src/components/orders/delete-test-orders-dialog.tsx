'use client'

import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { ordersContent } from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type DeleteTestOrdersDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** How many test orders the store has (the list's `testOrders`). */
  count: number
  /** Called after the delete, so the list and its counts reload. */
  onDeleted: () => void
}

/** "Delete test orders": confirms, then removes every order paid on a gateway's test keys. */
export default function DeleteTestOrdersDialog({
  open,
  onOpenChange,
  count,
  onDeleted,
}: DeleteTestOrdersDialogProps) {
  // Hooks
  const { deleteTests: copy } = useCopy(ordersContent)

  // Event handlers
  const handleConfirm = async () => {
    try {
      const { deleted } = await api.orders.deleteTestOrders()
      toast.success(copy.done(deleted))
      onDeleted()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
      throw err
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title(count)}
      body={copy.body}
      confirmLabel={copy.confirm}
      onConfirm={handleConfirm}
    />
  )
}
