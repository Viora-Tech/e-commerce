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
import { themesContent } from '@/data/themes'

type DeleteThemeDialogProps = {
  theme: { id: string; name: string } | null
  onCancel: () => void
  onConfirm: (id: string) => void
}

const copy = themesContent.deleteDialog

/** Guard in front of deleting a library theme. The live theme never offers delete. */
export default function DeleteThemeDialog({ theme, onCancel, onConfirm }: DeleteThemeDialogProps) {
  // Render logic
  return (
    <AlertDialog open={theme !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title(theme?.name ?? '')}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => theme && onConfirm(theme.id)}>
            {copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
