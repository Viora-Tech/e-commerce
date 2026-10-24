'use client'

import { ShoppingCart, UserRound } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import { inboxConversationsContent } from '@/data/inbox-conversations'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Panel = Awaited<ReturnType<typeof api.inbox.panel>>

type CustomerPanelProps = {
  conversationId: string
  /** What the shopper typed in the chat (shown for guests). */
  contact: { email: string | null; phone: string | null; startedUrl: string | null }
  /** Bumped by the parent when a cart line arrives, so the live cart reloads. */
  refreshKey: number
  canReadOrders: boolean
}

/**
 * Who the shopper is: new or returning, signed in or a possible match (unverified, so no
 * orders), their live cart, recent orders and the customer note.
 */
export default function CustomerPanel({
  conversationId,
  contact,
  refreshKey,
  canReadOrders,
}: CustomerPanelProps) {
  // Hooks
  const copy = useCopy(inboxConversationsContent)
  const fmt = useFormat()
  const [panel, setPanel] = useState<Panel | null>(null)

  useEffect(() => {
    if (refreshKey < 0) return
    let live = true
    api.inbox.panel({ id: conversationId }).then((p) => {
      if (live) setPanel(p)
    })
    return () => {
      live = false
    }
  }, [conversationId, refreshKey])

  // Early returns
  if (!panel) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  // Render logic
  const p = copy.panel
  const c = panel.customer

  return (
    <div className="flex flex-col gap-5 p-4">
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip tone={panel.returning ? 'info' : 'neutral'}>
            {panel.returning ? p.returning : p.new}
          </StatusChip>
          {c ? (
            <StatusChip tone="success">{p.verified}</StatusChip>
          ) : (
            <StatusChip tone="attention">{p.unverified}</StatusChip>
          )}
        </div>
        {c ? (
          <>
            <p className="text-body-strong text-ink-strong">{c.name ?? c.email}</p>
            {c.email ? <p className="text-caption text-muted-foreground">{c.email}</p> : null}
            <p className="text-caption text-muted-foreground">
              {p.totalSpent(fmt.money(c.totalSpentPaise), c.orderCount)}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              nativeButton={false}
              render={<Link href={routes.customers.detail(c.id)} />}
            >
              <UserRound aria-hidden="true" />
              {p.openCustomer}
            </Button>
          </>
        ) : (
          <>
            <p className="text-body-strong text-ink-strong">{contact.email ?? p.guest}</p>
            {contact.phone ? (
              <p className="text-caption text-muted-foreground">
                {p.phone}: {contact.phone}
              </p>
            ) : null}
            {panel.possibleMatch ? (
              <div className="flex flex-col gap-1 rounded-lg border border-dashed border-hairline p-3">
                <p className="text-caption font-medium text-foreground">{p.possibleMatch}</p>
                <Link
                  href={routes.customers.detail(panel.possibleMatch.id)}
                  className="text-body underline"
                >
                  {panel.possibleMatch.name ?? panel.possibleMatch.email}
                </Link>
                <p className="text-caption text-muted-foreground">{p.possibleMatchHelp}</p>
              </div>
            ) : null}
          </>
        )}
        {contact.startedUrl ? (
          <p className="truncate text-caption text-muted-foreground" title={contact.startedUrl}>
            {copy.thread.startedOn(contact.startedUrl)}
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 text-eyebrow text-muted-foreground">
          <ShoppingCart className="size-3.5" aria-hidden="true" />
          {p.cart}
        </h3>
        {panel.cart && panel.cart.lines.length > 0 ? (
          <>
            <ul className="flex flex-col gap-1">
              {panel.cart.lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-2 text-body">
                  <span className="truncate">
                    {l.quantity} × {l.productTitle}
                  </span>
                  <span className="shrink-0 tabular-nums">{fmt.money(l.linePaise)}</span>
                </li>
              ))}
            </ul>
            <p className="text-caption text-muted-foreground">
              {p.cartTotal(panel.cart.itemCount, fmt.money(panel.cart.subtotalPaise))}
            </p>
          </>
        ) : (
          <p className="text-caption text-muted-foreground">{p.emptyCart}</p>
        )}
      </section>

      {c ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-eyebrow text-muted-foreground">{p.orders}</h3>
          {!canReadOrders ? (
            <p className="text-caption text-muted-foreground">{p.ordersHidden}</p>
          ) : panel.orders.length === 0 ? (
            <p className="text-caption text-muted-foreground">{p.noOrders}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {panel.orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 text-body">
                  <Link href={routes.orders.detail(o.id)} className="underline">
                    #{o.number}
                  </Link>
                  <RelativeTime value={o.placedAt} className="text-caption text-muted-foreground" />
                  <span className="tabular-nums">{fmt.money(o.totalPaise)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {c?.note ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-eyebrow text-muted-foreground">{p.note}</h3>
          <p className="text-body whitespace-pre-wrap">{c.note}</p>
        </section>
      ) : null}
    </div>
  )
}
