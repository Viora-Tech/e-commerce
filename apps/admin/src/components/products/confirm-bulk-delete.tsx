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
import { productsListContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'

type ConfirmBulkDeleteProps = {
  count: number
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/** Guard in front of a bulk delete; ordered products are archived, not removed. */
export default function ConfirmBulkDelete({
  count,
  open,
  busy,
  onOpenChange,
  onConfirm,
}: ConfirmBulkDeleteProps) {
  // Hooks
  const {
    bulk: { confirmDelete: copy },
  } = useCopy(productsListContent)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title(count)}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm} disabled={busy}>
            {copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
