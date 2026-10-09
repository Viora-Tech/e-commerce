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
import { collectionFormContent } from '@/data/collections'
import { useCopy } from '@/hooks/use-copy'

type DeleteCollectionDialogProps = {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** Guard before a collection is removed; its products stay in the catalogue. */
export default function DeleteCollectionDialog({
  open,
  onCancel,
  onConfirm,
}: DeleteCollectionDialogProps) {
  // Hooks
  const { delete: copy } = useCopy(collectionFormContent)

  // Render logic
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.heading}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
