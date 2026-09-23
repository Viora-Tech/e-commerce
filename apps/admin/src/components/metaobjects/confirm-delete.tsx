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

type ConfirmDeleteProps = {
  open: boolean
  busy: boolean
  title: string
  body: string
  confirm: string
  cancel: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/** Guard in front of a delete that cannot be undone. */
export default function ConfirmDelete({
  open,
  busy,
  title,
  body,
  confirm,
  cancel,
  onOpenChange,
  onConfirm,
}: ConfirmDeleteProps) {
  // Render logic
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm} disabled={busy}>
            {confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
