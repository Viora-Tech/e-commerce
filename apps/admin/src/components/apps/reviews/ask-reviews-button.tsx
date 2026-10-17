'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

/** "Ask for reviews": after a plain-words confirm, emails recent buyers who were never asked. */
export default function AskReviewsButton() {
  // Hooks
  const { list: copy } = useCopy(reviewsContent)
  const [open, setOpen] = useState(false)

  // Event handlers
  const handleAsk = async () => {
    try {
      const r = await api.reviews.ask()
      toast.success(copy.askDone(r.orders))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
      throw err
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        {copy.ask}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={copy.askTitle}
        body={copy.askBody}
        confirmLabel={copy.askConfirm}
        cancelLabel={copy.cancel}
        tone="default"
        onConfirm={handleAsk}
      />
    </>
  )
}
