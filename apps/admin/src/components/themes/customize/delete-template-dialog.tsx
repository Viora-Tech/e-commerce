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
import { customizeContent } from '@/data/customize'

type DeleteTemplateDialogProps = {
  /** The template's name as the picker shows it ("Products: preorder"). */
  name: string
  /** "3 products", or empty when nothing uses it. */
  used: string
  onCancel: () => void
  onConfirm: () => void
}

const copy = customizeContent.templates.deleteDialog

/** Guard in front of deleting an alternate. The default template never offers delete. */
export default function DeleteTemplateDialog({
  name,
  used,
  onCancel,
  onConfirm,
}: DeleteTemplateDialogProps) {
  // Render logic
  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title(name)}</AlertDialogTitle>
          <AlertDialogDescription>
            {copy.body}
            {used ? ` ${copy.fallback(used)}` : ''}
          </AlertDialogDescription>
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
