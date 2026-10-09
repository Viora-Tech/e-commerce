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
import { blogListContent } from '@/data/blog'
import { useCopy } from '@/hooks/use-copy'

type ConfirmDeleteArticlesProps = {
  count: number
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/** Guard in front of deleting blog posts, one or many. */
export default function ConfirmDeleteArticles({
  count,
  open,
  busy,
  onOpenChange,
  onConfirm,
}: ConfirmDeleteArticlesProps) {
  // Hooks
  const {
    bulk: { confirmDelete: copy },
  } = useCopy(blogListContent)

  // Render logic
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
