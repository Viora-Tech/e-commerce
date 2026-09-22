'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@commerce/ui/shadcn/alert-dialog'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { type MenuListItem, menusContent } from '@/data/menus'
import { api } from '@/lib/api-client'

type DeleteMenuDialogProps = {
  menu: MenuListItem
  onClose: () => void
}

const copy = menusContent.remove

/** Guard behind the row menu's Delete; the storefront drops the menu on the API's answer. */
export default function DeleteMenuDialog({ menu, onClose }: DeleteMenuDialogProps) {
  // Hooks
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleDelete = async () => {
    setBusy(true)
    try {
      const removed = await api.navigation.delete({ id: menu.id })
      if (!removed) {
        toast.error(copy.failed)
        return
      }
      toast.success(copy.done)
      onClose()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent onClick={(event) => event.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body(menu.title)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={handleDelete}>
            {busy ? copy.busy : copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
