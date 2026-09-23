'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import StatusLabel from '@/components/status/status-label'
import { giftCardDetailContent as copy } from '@/data/gift-cards'
import { api } from '@/lib/api-client'
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
    <PageBody className="gap-6">
      <PageHeader
        title={title}
        breadcrumbs={[{ label: copy.breadcrumb, href: '/products/gift-cards' }, { label: title }]}
        actions={
          <>
            <StatusLabel kind="giftCard" value={card.state} variant="pill" />
            {canResend ? (
              <Button variant="outline" onClick={handleResend} disabled={busy}>
                {copy.resend}
              </Button>
            ) : null}
            <Button
              variant={card.disabledAt ? 'default' : 'outline'}
              onClick={handleToggle}
              disabled={busy}
            >
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
    </PageBody>
  )
}
