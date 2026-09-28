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
import { customerPrivacyContent, dataRequestDetailContent } from '@/data/customer-privacy'

type AskAgainDialogProps = {
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

const copy = customerPrivacyContent.banner

/** Confirms showing the cookie banner to every shopper again. */
export default function AskAgainDialog({
  open,
  busy,
  onOpenChange,
  onConfirm,
}: AskAgainDialogProps) {
  // Render logic
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.askAgainConfirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{copy.askAgainConfirmBody}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{dataRequestDetailContent.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={busy}>
            {copy.askAgainConfirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
