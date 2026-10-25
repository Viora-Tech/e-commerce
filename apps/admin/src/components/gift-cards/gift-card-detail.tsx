'use client'

import { CancelCircle, CircleCheck, Gift, Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import ProoflyPageBody from '@/components/layout/proofly-page-body'
import OrderChip from '@/components/orders/order-chip'
import { giftCardDetailContent as copy } from '@/data/gift-cards'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import BalanceCard from './balance-card'
import CustomerCard from './customer-card'
import DetailsCard from './details-card'
import ExpiryCard from './expiry-card'
import HistoryCard from './history-card'
import NoteCard from './note-card'

export type GiftCardDetailData = NonNullable<Awaited<ReturnType<typeof api.giftCards.get>>>

type GiftCardDetailProps = { initial: GiftCardDetailData }

/** One gift card: balance and history on the left, customer, expiry and notes on the right. */
export default function GiftCardDetail({ initial }: GiftCardDetailProps) {
  // Hooks
  const [card, setCard] = useState(initial)
  const [busy, setBusy] = useState(false)

  // Helpers
  const reload = async () => {
    const next = await api.giftCards.get({ id: card.id })
    if (next) setCard(next)
  }

  // Event handlers
  const handleToggle = async () => {
    setBusy(true)
    try {
      const disabled = !card.disabledAt
      await api.giftCards.setDisabled({ id: card.id, disabled })
      toast.success(disabled ? copy.disabled : copy.enabled)
      await reload()
    } catch {
      toast.error(copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleResend = async () => {
    setBusy(true)
    try {
      const r = await api.giftCards.resend({ id: card.id })
      const ok = r.find((d) => d.ok)
      if (ok) toast.success(copy.resent(ok.to))
      else toast.error(r[0]?.error ?? copy.resendFailed)
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.resendFailed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const title = copy.title(card.lastCharacters)
  const canResend = card.canResend && Boolean(card.recipientEmail || card.customerEmail)

  return (
    <ProoflyPageBody>
      <PageHeader
        title={title}
        back={{ label: copy.breadcrumb, href: routes.products.giftCards() }}
        lead={{ kind: 'icon', node: <Gift aria-hidden="true" /> }}
        badges={<OrderChip kind="giftCard" value={card.state} />}
        actions={
          <>
            {canResend ? (
              <Button variant="outline" onClick={handleResend} disabled={busy}>
                <Send aria-hidden="true" />
                {copy.resend}
              </Button>
            ) : null}
            <Button
              variant={card.disabledAt ? 'default' : 'outline'}
              onClick={handleToggle}
              disabled={busy}
            >
              {card.disabledAt ? (
                <CircleCheck aria-hidden="true" />
              ) : (
                <CancelCircle aria-hidden="true" />
              )}
              {card.disabledAt ? copy.enable : copy.disable}
            </Button>
          </>
        }
      />
      <PageColumns
        main={
          <>
            <BalanceCard card={card} onChanged={reload} />
            <HistoryCard transactions={card.transactions} />
          </>
        }
        side={
          <>
            <CustomerCard card={card} />
            <ExpiryCard card={card} onChanged={reload} />
            <DetailsCard card={card} />
            <NoteCard card={card} onChanged={reload} />
          </>
        }
      />
    </ProoflyPageBody>
  )
}
