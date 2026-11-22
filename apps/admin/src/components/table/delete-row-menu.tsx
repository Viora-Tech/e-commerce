'use client'

import { Trash2 } from '@commerce/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu, { type ActionItem } from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { tableContent } from '@/data/table'
import { useCopy } from '@/hooks/use-copy'
import { errorText } from '@/lib/api-errors'

type DeleteRowMenuProps = {
  /** The menu item, e.g. "Delete". */
  label: string
  /** The confirm dialog's words, usually the detail page's own `confirmDelete`. */
  confirm: { title: string; body: string; confirm: string; cancel: string }
  /** Toast once it is gone; none when `onDelete` says so itself. */
  deleted?: string | undefined
  /** Toast when the API gives no reason of its own. */
  failed: string
  /** Absent: the row cannot be deleted (a shipping list's General profile), only the other items show. */
  onDelete?: (() => Promise<unknown>) | undefined
  /** The list re-reads its rows after the delete. */
  onChanged?: (() => void) | undefined
  /** Other actions listed above Delete (Edit, an inbound shipment's "Mark as delivered"). */
  before?: ActionItem[]
  /** The ⋯ button's name for screen readers ("Actions for Skates"); the table's "More" by default. */
  menuLabel?: string | undefined
  size?: 'sm' | undefined
}

/**
 * The one row ⋯ menu ending in Delete, asked first (suppliers, inbound shipments, shipping
 * profiles and areas). The confirm stays busy until the delete answers.
 */
export default function DeleteRowMenu({
  label,
  confirm,
  deleted,
  failed,
  onDelete,
  onChanged,
  before = [],
  menuLabel,
  size,
}: DeleteRowMenuProps) {
  // Hooks
  const copy = useCopy(tableContent)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleDelete = async () => {
    if (!onDelete) return
    setBusy(true)
    try {
      await onDelete()
    } catch (err) {
      toast.error(errorText(err, failed))
      return
    } finally {
      setBusy(false)
    }
    setOpen(false)
    if (deleted) toast.success(deleted)
    onChanged?.()
  }

  // Render logic
  return (
    <>
      <ActionMenu
        label={menuLabel ?? copy.more}
        size={size}
        items={[
          ...before,
          {
            label,
            icon: Trash2,
            destructive: true,
            hidden: !onDelete,
            onSelect: () => setOpen(true),
          },
        ]}
      />
      <ConfirmDialog
        tone="destructive"
        open={open}
        onOpenChange={setOpen}
        title={confirm.title}
        body={confirm.body}
        confirmLabel={confirm.confirm}
        cancelLabel={confirm.cancel}
        busy={busy}
        stopPropagation
        onConfirm={handleDelete}
      />
    </>
  )
}
