'use client'

import { PackageCheck, Trash2, Truck } from '@commerce/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import RowMenu from '@/components/table/row-menu'
import { type TransferStatus, transferFormContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type TransferRowMenuProps = {
  transfer: { id: string; status: TransferStatus; units: number }
  /** The list re-reads its rows after a change here. */
  onChanged: () => void
}

/** The ⋯ menu on a transfer row: ship or delete a draft, receive one in transit. */
export default function TransferRowMenu({ transfer, onChanged }: TransferRowMenuProps) {
  // Hooks
  const copy = useCopy(transferFormContent)
  const [deleting, setDeleting] = useState(false)

  // Helpers
  const act = async (call: () => Promise<unknown>, done: string) => {
    try {
      await call()
      toast.success(done)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.saveFailed)
    }
  }

  // Render logic
  const { id, status } = transfer

  return (
    <>
      <RowMenu
        items={[
          {
            label: copy.ship,
            icon: Truck,
            hidden: status !== 'draft' || transfer.units === 0,
            onSelect: () => act(() => api.transfers.ship({ id }), copy.shipped),
          },
          {
            label: copy.receive,
            icon: PackageCheck,
            hidden: status !== 'in_transit',
            onSelect: () => act(() => api.transfers.receive({ id }), copy.received),
          },
          {
            label: copy.delete,
            icon: Trash2,
            destructive: true,
            hidden: status !== 'draft',
            onSelect: () => setDeleting(true),
          },
        ]}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={copy.confirmDelete.title}
        body={copy.confirmDelete.body}
        confirmLabel={copy.confirmDelete.confirm}
        cancelLabel={copy.confirmDelete.cancel}
        stopPropagation
        onConfirm={() => act(() => api.transfers.delete({ id }), copy.deleted)}
      />
    </>
  )
}
