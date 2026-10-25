'use client'

import { ExternalLink, MessageSquare } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import { chatwootContent } from '@/data/chatwoot'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatAgo } from '@/lib/format-date'

type View = Awaited<ReturnType<typeof api.chatwoot.conversations.customer>>

type ConversationsCardProps = {
  /** Whose conversations: a customer's, or an order's customer's. */
  kind: 'customer' | 'order'
  /** The customer's or the order's id. */
  id: string
}

const APP = '/apps/chatwoot'

const loadFor = (kind: ConversationsCardProps['kind'], id: string): Promise<View> =>
  kind === 'customer'
    ? api.chatwoot.conversations.customer({ customerId: id })
    : api.chatwoot.conversations.order({ orderId: id })

const STATUS_TONE = {
  open: 'info',
  pending: 'warning',
  snoozed: 'neutral',
  resolved: 'success',
} as const

/**
 * The Chatwoot app's card on the customer and order pages: the contact's latest conversations
 * with their status and last message, each linking into Chatwoot. Draws a quiet line for every
 * other state (not connected, no contact yet, Chatwoot unreachable) and never fails the page.
 */
export default function ConversationsCard({ kind, id }: ConversationsCardProps) {
  // Hooks
  const content = useCopy(chatwootContent)
  const locale = useLocale()
  const [view, setView] = useState<View | null>(null)

  useEffect(() => {
    let live = true
    loadFor(kind, id)
      .then((v) => {
        if (live) setView(v)
      })
      .catch(() => {
        if (live) setView({ state: 'error', message: '' })
      })
    return () => {
      live = false
    }
  }, [kind, id])

  // Early returns
  if (!view || view.state === 'not-installed') return null

  // Render logic
  const copy = content.card
  const openLink =
    view.state === 'ready'
      ? view.contactUrl
      : view.state === 'no-contact'
        ? view.dashboardUrl
        : null
  const conversations = view.state === 'ready' ? view.conversations : []

  return (
    <DataCard
      title={copy.title}
      count={view.state === 'ready' ? conversations.length : undefined}
      action={
        openLink ? (
          <a
            href={openLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground"
          >
            {view.state === 'ready' ? copy.contact : copy.open}
            <ExternalLink className="size-3.5" />
          </a>
        ) : (
          <Link href={APP} className="text-caption text-muted-foreground hover:text-foreground">
            {copy.settings}
          </Link>
        )
      }
    >
      <div className="flex flex-col gap-2">
        {view.state === 'not-connected' ? (
          <p className="text-body text-muted-foreground">{copy.notConnected}</p>
        ) : null}
        {view.state === 'error' ? (
          <p className="text-body text-muted-foreground">
            {copy.error} {view.message}
          </p>
        ) : null}
        {view.state === 'no-contact' ? (
          <p className="text-body text-muted-foreground">{copy.noContact}</p>
        ) : null}
        {view.state === 'ready' && conversations.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.empty}</p>
        ) : null}
        {conversations.map((c) => (
          <a
            key={c.id}
            href={c.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-3 rounded-[0.5rem] border border-border p-2.5 hover:bg-muted"
          >
            <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-body">{c.preview ?? copy.noPreview}</span>
              <span className="text-caption text-muted-foreground">
                #{c.id}
                {c.lastActivityAt ? ` · ${formatAgo(c.lastActivityAt, new Date(), locale)}` : ''}
                {c.unreadCount > 0 ? ` · ${copy.unread(c.unreadCount)}` : ''}
              </span>
            </span>
            <Badge variant={STATUS_TONE[c.status]}>{copy.statuses[c.status]}</Badge>
          </a>
        ))}
      </div>
    </DataCard>
  )
}
