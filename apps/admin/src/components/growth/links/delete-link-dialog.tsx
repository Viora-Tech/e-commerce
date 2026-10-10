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
import { growthLinksContent } from '@/data/growth'
import { useCopy } from '@/hooks/use-copy'

type DeleteLinkDialogProps = {
  name: string
  onCancel: () => void
  onConfirm: () => void
}

/** Guard in front of deleting a short link: it stops working, its orders stay credited. */
export default function DeleteLinkDialog({ name, onCancel, onConfirm }: DeleteLinkDialogProps) {
  // Hooks
  const copy = useCopy(growthLinksContent.deleteDialog)

  // Render logic
  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title(name)}</AlertDialogTitle>
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
