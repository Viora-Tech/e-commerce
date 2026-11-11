'use client'

import { maskedGiftCardCode } from '@commerce/core/gift-cards'
import { permissions } from '@commerce/core/permissions'
import { dayStart } from '@commerce/dates'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import { storeCreditGiftCardsContent } from '@/data/store-credit-gift-cards'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { formatPattern } from '@/lib/format-date'
import { formatPaise } from '@/lib/money'

type StoreCreditCardsCardProps = {
  /** After cards moved: the gift card list refreshes (their balances are now zero). */
  onMoved: () => void
}

type Card = Awaited<ReturnType<typeof api.storeCredit.listGiftCards>>[number]

const movable = (c: Card) => c.problem === null

/**
 * Old gift cards that were really store credit (refund cards made here before the balance, and
 * cards the Shopify import brought), with "Move to balance": each card's value left goes onto its
 * customer's store credit balance and the card stops working. Hidden when there are none.
 */
export default function StoreCreditCardsCard({ onMoved }: StoreCreditCardsCardProps) {
  // Hooks
  const copy = useCopy(storeCreditGiftCardsContent)
  const locale = useLocale()
  const { hasPermission } = usePermissions()
  const [cards, setCards] = useState<Card[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const canRead = hasPermission(permissions.CUSTOMERS_READ)

  useEffect(() => {
    if (!canRead) return
    let live = true
    api.storeCredit
      .listGiftCards()
      .then((rows) => {
        if (!live) return
        setCards(rows)
        setPicked(new Set(rows.filter((c) => c.suggested && movable(c)).map((c) => c.id)))
      })
      .catch(() => {
        if (live) setCards([])
      })
    return () => {
      live = false
    }
  }, [canRead])

  // Helpers
  const money = (paise: number) => formatPaise(paise, locale)
  const lastDay = (day: string) =>
    formatPattern(dayStart(day), { day: 'numeric', month: 'short', year: 'numeric' }, locale)
  const reload = async () => {
    const rows = await api.storeCredit.listGiftCards()
    setCards(rows)
    setPicked(new Set())
  }

  // Event handlers
  const handleToggle = (id: string, on: boolean) => {
    const next = new Set(picked)
    if (on) next.add(id)
    else next.delete(id)
    setPicked(next)
  }
  const handleToggleAll = (on: boolean) => {
    setPicked(new Set(on ? (cards ?? []).filter(movable).map((c) => c.id) : []))
  }
  const handleMove = async () => {
    try {
      const results = await api.storeCredit.moveGiftCards({ giftCardIds: [...picked] })
      const moved = results.filter((r) => r.status !== 'skipped').length
      const skipped = results.filter((r) => r.status === 'skipped')
      const msg = copy.done(moved, skipped.length)
      if (skipped.length > 0) {
        toast.warning(msg, {
          description: skipped
            .map((r) => {
              const card = cards?.find((c) => c.id === r.giftCardId)
              const why = r.status === 'skipped' ? (copy.skipped[r.reason] ?? r.reason) : ''
              return `${card ? maskedGiftCardCode(card.lastCharacters) : ''} ${why}`.trim()
            })
            .join(', '),
        })
      } else {
        toast.success(msg)
      }
      setConfirming(false)
      onMoved()
      await reload()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
      throw err
    }
  }

  // Early returns
  if (!canRead || !cards || cards.length === 0) return null

  // Render logic
  const canMove = hasPermission(permissions.CUSTOMERS_WRITE)
  const movableCards = cards.filter(movable)
  const allPicked = movableCards.length > 0 && movableCards.every((c) => picked.has(c.id))
  const pickedTotal = cards
    .filter((c) => picked.has(c.id))
    .reduce((sum, c) => sum + c.balancePaise, 0)

  return (
    <DataCard
      title={copy.heading}
      className="rounded-xl"
      action={
        canMove ? (
          <Button size="sm" disabled={picked.size === 0} onClick={() => setConfirming(true)}>
            {copy.move(picked.size)}
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-caption text-muted-foreground">{copy.intro}</p>
        <p className="text-caption text-muted-foreground">{copy.suggestedNote}</p>
        {canMove && movableCards.length > 1 ? (
          <label className="flex items-center gap-2 text-body">
            <Checkbox checked={allPicked} onCheckedChange={(v) => handleToggleAll(Boolean(v))} />
            {copy.selectAll}
          </label>
        ) : null}
        <ul className="flex flex-col divide-y divide-line">
          {cards.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 py-2">
              <label className="flex min-w-0 items-start gap-2">
                {canMove ? (
                  <Checkbox
                    className="mt-0.5"
                    checked={picked.has(c.id)}
                    disabled={!movable(c)}
                    onCheckedChange={(v) => handleToggle(c.id, Boolean(v))}
                  />
                ) : null}
                <span className="min-w-0">
                  <span className="block font-mono text-body-strong tracking-wide">
                    {maskedGiftCardCode(c.lastCharacters)}
                  </span>
                  <span className="block text-caption text-muted-foreground">
                    {copy.origin[c.origin]} ·{' '}
                    {c.problem
                      ? (copy.problems[c.problem] ?? c.problem)
                      : c.customerId
                        ? copy.to(c.customerName || c.email || '')
                        : copy.newCustomer(c.email ?? '')}
                  </span>
                  {c.expiresOn && !c.problem ? (
                    <span className="block text-caption text-muted-foreground">
                      {copy.expires(lastDay(c.expiresOn))}
                    </span>
                  ) : null}
                </span>
              </label>
              <span className="shrink-0 tabular-nums text-foreground">{money(c.balancePaise)}</span>
            </li>
          ))}
        </ul>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={copy.confirmTitle}
        body={copy.confirmBody(money(pickedTotal))}
        confirmLabel={copy.confirm}
        tone="default"
        onConfirm={handleMove}
      />
    </DataCard>
  )
}
