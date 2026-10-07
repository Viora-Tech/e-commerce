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
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { toast } from 'sonner'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

/** "Ask for reviews": after a plain-words confirm, emails recent buyers who were never asked. */
export default function AskReviewsButton() {
  // Hooks
  const { list: copy } = useCopy(reviewsContent)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleAsk = async () => {
    setBusy(true)
    try {
      const r = await api.reviews.ask()
      toast.success(copy.askDone(r.orders))
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        {copy.ask}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.askTitle}</AlertDialogTitle>
            <AlertDialogDescription>{copy.askBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleAsk} disabled={busy}>
              {busy ? <Spinner /> : null}
              {copy.askConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
