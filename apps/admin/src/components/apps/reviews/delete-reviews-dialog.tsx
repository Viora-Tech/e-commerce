'use client'

import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
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

  // Event handlers
  const handleDelete = async () => {
    try {
      const { deleted } = await api.reviews.delete({ ids })
      toast.success(copy.bulk.deleted(deleted))
      onDeleted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
      throw err
    }
  }

  // Render logic
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.deleteTitle(ids.length)}
      body={copy.deleteBody}
      confirmLabel={copy.bulk.delete}
      cancelLabel={copy.cancel}
      onConfirm={handleDelete}
    />
  )
}
