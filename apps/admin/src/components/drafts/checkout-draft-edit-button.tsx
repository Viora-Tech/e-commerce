'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { checkoutDraftEditContent } from '@/data/checkout-draft-edit'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { takeOverRefusal } from './checkout-draft-take-over'

type CheckoutDraftEditButtonProps = {
  /** The shopper's unpaid checkout draft. */
  draftId: string
}

/**
 * "Edit" on a shopper's unpaid checkout: a confirm popup first (the shopper's link stops and
 * they will need the new one), then the API takes it over as a staff draft and the page
 * reloads into the normal draft form.
 */
export default function CheckoutDraftEditButton({ draftId }: CheckoutDraftEditButtonProps) {
  // Hooks
  const copy = useCopy(checkoutDraftEditContent)
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Event handlers
  const handleConfirm = async () => {
    try {
      await api.orders.takeOverCheckoutDraft({ id: draftId })
      toast.success(copy.done)
      setOpen(false)
      // The page reads the draft again: a staff draft now, so it opens in the draft form.
      router.refresh()
    } catch (err) {
      const reason = takeOverRefusal(err)
      toast.error(reason ? copy.refused[reason] : copy.failed)
      throw err
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {copy.edit}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={copy.confirmTitle}
        body={copy.confirmBody}
        confirmLabel={copy.confirm}
        cancelLabel={copy.cancel}
        tone="default"
        onConfirm={handleConfirm}
      />
    </>
  )
}
