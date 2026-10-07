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
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { toast } from 'sonner'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type DeleteReviewsDialogProps = {
  ids: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

/** "Delete N reviews?" with a plain-words warning; deleting is final. */
export default function DeleteReviewsDialog({
  ids,
  open,
  onOpenChange,
  onDeleted,
}: DeleteReviewsDialogProps) {
  // Hooks
  const { list: copy } = useCopy(reviewsContent)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleDelete = async () => {
    setBusy(true)
    try {
      const { deleted } = await api.reviews.delete({ ids })
      toast.success(copy.bulk.deleted(deleted))
      onOpenChange(false)
      onDeleted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.deleteTitle(ids.length)}</AlertDialogTitle>
          <AlertDialogDescription>{copy.deleteBody}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={busy}>
            {busy ? <Spinner /> : null}
            {copy.bulk.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
