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
import { redirectsContent } from '@/data/redirects'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type DeleteRedirectsDialogProps = {
  ids: string[]
  onClose: () => void
  onDeleted: () => void
}

export default function DeleteRedirectsDialog({
  ids,
  onClose,
  onDeleted,
}: DeleteRedirectsDialogProps) {
  // Hooks
  const { actions: copy } = useCopy(redirectsContent)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleDelete = async () => {
    setBusy(true)
    try {
      const n = await api.redirects.delete({ ids })
      toast.success(copy.deleted(n))
      onDeleted()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.deleteFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent onClick={(event) => event.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.confirmTitle(ids.length)}</AlertDialogTitle>
          <AlertDialogDescription>{copy.confirmBody}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={handleDelete}>
            {copy.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
