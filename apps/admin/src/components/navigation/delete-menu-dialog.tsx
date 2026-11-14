'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { type MenuListItem, menusContent } from '@/data/menus'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type DeleteMenuDialogProps = {
  menu: MenuListItem
  onClose: () => void
  /** Runs instead of refreshing the page, e.g. to leave the editor of the deleted menu. */
  onDeleted?: () => void
}

/** Guard behind the row menu's Delete; the storefront drops the menu on the API's answer. */
export default function DeleteMenuDialog({ menu, onClose, onDeleted }: DeleteMenuDialogProps) {
  // Hooks
  const { remove: copy } = useCopy(menusContent)
  const router = useRouter()

  // Event handlers
  const handleDelete = async () => {
    try {
      const removed = await api.navigation.delete({ id: menu.id })
      if (!removed) throw new Error(copy.failed)
      toast.success(copy.done)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
      throw err
    }
    if (onDeleted) onDeleted()
    else router.refresh()
  }

  // Render logic
  return (
    <ConfirmDialog
      tone="destructive"
      open
      onOpenChange={(open) => !open && onClose()}
      title={copy.title}
      body={copy.body(menu.title)}
      confirmLabel={copy.confirm}
      cancelLabel={copy.cancel}
      stopPropagation
      onConfirm={handleDelete}
    />
  )
}
