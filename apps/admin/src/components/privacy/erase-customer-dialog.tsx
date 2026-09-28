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
import { dataRequestDetailContent as copy } from '@/data/customer-privacy'

type EraseCustomerDialogProps = {
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/** Confirms erasing a customer's personal data; says plainly what is kept and that it is final. */
export default function EraseCustomerDialog({
  open,
  busy,
  onOpenChange,
  onConfirm,
}: EraseCustomerDialogProps) {
  // Render logic
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.eraseTitle}</AlertDialogTitle>
          <AlertDialogDescription>{copy.eraseBody}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm} disabled={busy}>
            {copy.eraseConfirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
