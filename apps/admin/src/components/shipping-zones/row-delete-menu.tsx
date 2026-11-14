'use client'

import { Pencil, Trash2 } from '@commerce/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { shippingRatesContent } from '@/data/shipping-rates'
import { useCopy } from '@/hooks/use-copy'

type RowDeleteMenuProps = {
  /** "Skates": names the menu and the confirm title. */
  name: string
  editHref: string
  /** Absent: the row has no Delete (the General profile). */
  onDelete?: (() => Promise<void>) | undefined
  confirm: { title: (name: string) => string; body: string; confirm: string; cancel: string }
}

/**
 * A shipping list row's ⋯ menu (profiles, delivery areas): Edit opens the row's page, Delete
 * asks first with the same words as that page's Delete button.
 */
export default function RowDeleteMenu({ name, editHref, onDelete, confirm }: RowDeleteMenuProps) {
  // Hooks
  const copy = useCopy(shippingRatesContent.rowMenu)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)

  // Handlers
  const handleConfirm = async () => {
    if (!onDelete) return
    setBusy(true)
    try {
      await onDelete()
      setAsking(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ActionMenu
        label={copy.label(name)}
        size="sm"
        items={[
          { label: copy.edit, icon: Pencil, href: editHref },
          {
            label: copy.delete,
            icon: Trash2,
            destructive: true,
            hidden: !onDelete,
            onSelect: () => setAsking(true),
          },
        ]}
      />
      <ConfirmDialog
        tone="destructive"
        open={asking}
        onOpenChange={setAsking}
        title={confirm.title(name)}
        body={confirm.body}
        confirmLabel={confirm.confirm}
        cancelLabel={confirm.cancel}
        busy={busy}
        onConfirm={handleConfirm}
      />
    </>
  )
}
