'use client'

import { Trash2 } from '@commerce/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import RowMenu from './row-menu'

type DeleteRowMenuProps = {
  /** The menu item, e.g. "Delete". */
  label: string
  /** The confirm dialog's words, usually the detail page's own `confirmDelete`. */
  confirm: { title: string; body: string; confirm: string; cancel: string }
  /** Toast once it is gone. */
  deleted: string
  /** Toast when the API gives no reason of its own. */
  failed: string
  onDelete: () => Promise<unknown>
  /** The list re-reads its rows after the delete. */
  onChanged: () => void
}

/** A row ⋯ menu whose only action is Delete, asked first (suppliers, inbound shipments). */
export default function DeleteRowMenu({
  label,
  confirm,
  deleted,
  failed,
  onDelete,
  onChanged,
}: DeleteRowMenuProps) {
  // Hooks
  const [open, setOpen] = useState(false)

  // Event handlers
  const handleDelete = async () => {
    try {
      await onDelete()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : failed)
      return
    }
    toast.success(deleted)
    onChanged()
  }

  return (
    <>
      <RowMenu
        items={[{ label, icon: Trash2, destructive: true, onSelect: () => setOpen(true) }]}
      />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={confirm.title}
        body={confirm.body}
        confirmLabel={confirm.confirm}
        cancelLabel={confirm.cancel}
        stopPropagation
        onConfirm={handleDelete}
      />
    </>
  )
}
