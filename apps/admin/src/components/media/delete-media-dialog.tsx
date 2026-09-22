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
import { useState } from 'react'
import { toast } from 'sonner'
import { mediaContent } from '@/data/media'
import { api } from '@/lib/api-client'

type DeleteMediaDialogProps = {
  item: { id: string; usedBy: number } | null
  onClose: () => void
  onDeleted: (id: string) => void
}

const copy = mediaContent.library

export default function DeleteMediaDialog({ item, onClose, onDeleted }: DeleteMediaDialogProps) {
  // Hooks
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleOpenChange = (open: boolean) => {
    if (!open && !busy) onClose()
  }
  const handleConfirm = async () => {
    if (!item) return
    setBusy(true)
    try {
      await api.media.delete({ id: item.id })
      onDeleted(item.id)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : mediaContent.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={item !== null} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.deleteTitle}</AlertDialogTitle>
          <AlertDialogDescription>{copy.deleteBody(item?.usedBy ?? 0)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleConfirm} disabled={busy}>
            {copy.deleteConfirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
