'use client'

import { CancelCircle, Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { bulkActionsContent } from '@/data/bulk-actions'
import { giftCardListActionsContent } from '@/data/gift-cards'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { runBatched, toastOutcome } from '@/lib/run-batched'

type GiftCardsBulkActionsProps = {
  ids: string[]
  /** After the loop: clear the selection and reload. */
  onDone: () => void
}

/** The gift card list's selection bar: disable the cards, or email their codes again. */
export default function GiftCardsBulkActions({ ids, onDone }: GiftCardsBulkActionsProps) {
  // Hooks
  const copy = useCopy(giftCardListActionsContent)
  const shared = useCopy(bulkActionsContent)
  const [confirm, setConfirm] = useState<'disable' | 'resend' | null>(null)

  // Event handlers
  const handleDisable = async () => {
    const outcome = await runBatched(ids, (id) => api.giftCards.setDisabled({ id, disabled: true }))
    toastOutcome(outcome, shared.summary)
    onDone()
  }

  /* A card with no address resolves with failed deliveries rather than throwing. */
  const handleResend = async () => {
    const outcome = await runBatched(
      ids,
      (id) => api.giftCards.resend({ id }),
      (deliveries) => deliveries.some((d) => d.ok),
    )
    toastOutcome(outcome, shared.summary)
    onDone()
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setConfirm('resend')}>
        <Send aria-hidden="true" />
        {copy.resend}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setConfirm('disable')}>
        <CancelCircle aria-hidden="true" />
        {copy.disable}
      </Button>
      <ConfirmDialog
        open={confirm === 'resend'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={copy.confirmResend.title(ids.length)}
        body={copy.confirmResend.body}
        confirmLabel={copy.confirmResend.confirm}
        cancelLabel={copy.confirmResend.cancel}
        tone="default"
        onConfirm={handleResend}
      />
      <ConfirmDialog
        tone="destructive"
        open={confirm === 'disable'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={copy.confirmDisable.title(ids.length)}
        body={copy.confirmDisable.body}
        confirmLabel={copy.confirmDisable.confirm}
        cancelLabel={copy.confirmDisable.cancel}
        onConfirm={handleDisable}
      />
    </>
  )
}
