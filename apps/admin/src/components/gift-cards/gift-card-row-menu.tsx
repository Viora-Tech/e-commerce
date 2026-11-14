'use client'

import { CancelCircle, CircleCheck, Eye, Send } from '@commerce/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import RowMenu from '@/components/table/row-menu'
import { giftCardListActionsContent } from '@/data/gift-cards'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type GiftCardRowMenuProps = {
  card: {
    id: string
    state: string
    disabledAt: Date | string | null
    recipientEmail: string | null
    customerEmail: string | null
  }
  /** The list re-reads its rows after a change here. */
  onChanged: () => void
}

/** The ⋯ menu on a gift card row: open, email the code again, disable or enable. */
export default function GiftCardRowMenu({ card, onChanged }: GiftCardRowMenuProps) {
  // Hooks
  const copy = useCopy(giftCardListActionsContent)
  const [disabling, setDisabling] = useState(false)

  // Event handlers
  const handleResend = async () => {
    const deliveries = await api.giftCards.resend({ id: card.id }).catch((err: unknown) => {
      toast.error(err instanceof Error ? err.message : copy.resendFailed)
      return null
    })
    if (!deliveries) return
    const sent = deliveries.find((d) => d.ok)
    if (sent) toast.success(copy.resent(sent.to))
    else toast.error(deliveries[0]?.error ?? copy.resendFailed)
    onChanged()
  }

  const handleDisabled = async (disabled: boolean) => {
    const result = await api.giftCards
      .setDisabled({ id: card.id, disabled })
      .then(() => true)
      .catch(() => false)
    if (!result) return void toast.error(copy.failed)
    toast.success(disabled ? copy.disabled : copy.enabled)
    onChanged()
  }

  // Render logic
  const off = card.disabledAt !== null
  const email = card.recipientEmail || card.customerEmail

  return (
    <>
      <RowMenu
        items={[
          { label: copy.open, icon: Eye, href: routes.products.giftCard(card.id) },
          {
            label: copy.resend,
            icon: Send,
            hidden: card.state !== 'active' || !email,
            onSelect: handleResend,
          },
          off
            ? { label: copy.enable, icon: CircleCheck, onSelect: () => handleDisabled(false) }
            : {
                label: copy.disable,
                icon: CancelCircle,
                destructive: true,
                onSelect: () => setDisabling(true),
              },
        ]}
      />
      <ConfirmDialog
        tone="destructive"
        open={disabling}
        onOpenChange={setDisabling}
        title={copy.confirmDisable.title(1)}
        body={copy.confirmDisable.body}
        confirmLabel={copy.confirmDisable.confirm}
        cancelLabel={copy.confirmDisable.cancel}
        stopPropagation
        onConfirm={() => handleDisabled(true)}
      />
    </>
  )
}
