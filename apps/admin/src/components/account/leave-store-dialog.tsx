'use client'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@commerce/ui/shadcn/alert-dialog'
import { Button } from '@commerce/ui/shadcn/button'
import { accountContent } from '@/data/account'
import { useCopy } from '@/hooks/use-copy'

type LeaveStoreDialogProps = {
  /** The store being left; null keeps the dialog closed. */
  storeName: string | null
  /** Leaving the only store sends the member to create one, so the dialog says so. */
  lastStore: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/** "Leave <store>?": says access ends now and only a new invite brings it back. */
export default function LeaveStoreDialog({
  storeName,
  lastStore,
  busy,
  onOpenChange,
  onConfirm,
}: LeaveStoreDialogProps) {
  // Hooks
  const {
    stores: { leaveDialog: copy },
  } = useCopy(accountContent)

  return (
    <AlertDialog open={storeName !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title(storeName ?? '')}</AlertDialogTitle>
          <AlertDialogDescription>
            {copy.body}
            {lastStore ? ` ${copy.lastStore}` : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{copy.cancel}</AlertDialogCancel>
          <Button variant="destructive" onClick={onConfirm} loading={busy}>
            {copy.confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
