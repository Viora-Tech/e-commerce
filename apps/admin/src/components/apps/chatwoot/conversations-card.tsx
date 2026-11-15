'use client'

import { ExternalLink, MessageSquare } from '@commerce/ui/icons'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { appsContent } from '@/data/apps'
import { chatwootContent } from '@/data/chatwoot'
import { useCopy, useLocale } from '@/hooks/use-copy'
import type { LoadFailure } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { isForbidden } from '@/lib/forbidden'
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
  pending: 'attention',
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
  const apps = useCopy(appsContent)
  const content = useCopy(chatwootContent)
  const locale = useLocale()
  const [view, setView] = useState<View | null>(null)
  /** Our own read failed (not Chatwoot): the card says so with Try again (or no-access). */
  const [failed, setFailed] = useState<LoadFailure | false>(false)
  const [attempt, setAttempt] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is Try again
  useEffect(() => {
    let live = true
    setFailed(false)
    loadFor(kind, id)
      .then((v) => {
        if (live) setView(v)
      })
      .catch((err: unknown) => {
        if (live) setFailed(isForbidden(err) ? 'no-access' : 'error')
      })
    return () => {
      live = false
    }
  }, [kind, id, attempt])

  // Early returns
  if (failed && !view) {
    return (
      <DataCard title={content.card.title}>
        <LoadFailedState
          heading={apps.couldNotLoad.conversations}
          failed={failed}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      </DataCard>
    )
  }
  if (!view || view.state === 'not-installed') return null
  // Nothing to show is no card: order and customer pages stacked empty ones (audit #12, #84).
  if (view.state === 'not-connected' || view.state === 'no-contact') return null
  if (view.state === 'ready' && view.conversations.length === 0) return null

  // Render logic
  const copy = content.card
  const openLink = view.state === 'ready' ? view.contactUrl : null
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
        {view.state === 'error' ? (
          <p className="text-body text-muted-foreground">
            {copy.error} {view.message}
          </p>
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
            <StatusChip tone={STATUS_TONE[c.status]}>{copy.statuses[c.status]}</StatusChip>
          </a>
        ))}
      </div>
    </DataCard>
  )
}
