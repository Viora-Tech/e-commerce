'use client'

import type { ActivityAttention, ActivityEvent, ActivityFeed } from '@commerce/core'
import { Bell } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { activityContent } from '@/data/activity'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import RelativeTime from './relative-time'

type ActivityBellProps = {
  /** Whose "seen" mark this is: the bell remembers it per member in this browser. */
  memberKey: string
  /** The trigger's classes (the top bar's round icon button). */
  className: string
}

const POLL_MS = 60_000

const ATTENTION_LINK: Record<keyof ActivityAttention, () => string> = {
  refundsNeeded: () => routes.orders.list(),
  outOfStock: () => routes.stock.inventory(),
  lowStock: () => routes.stock.inventory(),
  returnsRequested: () => routes.orders.returns(),
  mediaFailed: () => routes.content.files(),
}

const ATTENTION_ORDER: readonly (keyof ActivityAttention)[] = [
  'refundsNeeded',
  'returnsRequested',
  'outOfStock',
  'lowStock',
  'mediaFailed',
]

function eventHref(e: ActivityEvent): string {
  if (e.kind === 'order') return routes.orders.detail(e.id)
  if (e.kind === 'refund_needed') return routes.orders.detail(e.orderId)
  return routes.orders.returnDetail(e.id)
}

const seenKey = (memberKey: string) => `activity-seen:${memberKey}`

function readSeen(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function writeSeen(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {}
}

/**
 * The top bar's bell: what needs the merchant now (refunds, stock, returns, failed photos) and
 * what happened in the last week, each line a link to where it is handled. A dot counts events
 * newer than the member last opened it; refreshed every minute while the tab is visible.
 */
export default function ActivityBell({ memberKey, className }: ActivityBellProps) {
  // Hooks
  const copy = useCopy(activityContent)
  const format = useFormat()
  const [feed, setFeed] = useState<ActivityFeed | null>(null)
  const [failed, setFailed] = useState(false)
  const [seen, setSeen] = useState('')

  useEffect(() => {
    setSeen(readSeen(seenKey(memberKey)))
    let live = true
    const load = () => {
      if (document.visibilityState !== 'visible') return
      api.activity
        .feed()
        .then((f) => {
          if (!live) return
          setFeed(f)
          setFailed(false)
        })
        .catch(() => live && setFailed(true))
    }
    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [memberKey])

  // Helpers
  const eventText = (e: ActivityEvent) =>
    e.kind === 'order'
      ? copy.event.order(e.number, format.money(e.totalPaise))
      : e.kind === 'refund_needed'
        ? copy.event.refund_needed(e.number, format.money(e.amountPaise))
        : copy.event.return(e.number)

  // Event handlers
  const handleOpenChange = (open: boolean) => {
    if (!open || !feed?.events[0]) return
    writeSeen(seenKey(memberKey), feed.events[0].at)
    setSeen(feed.events[0].at)
  }

  // Render logic
  const unread = feed ? feed.events.filter((e) => e.at > seen).length : 0
  const attention = feed
    ? ATTENTION_ORDER.filter((k) => feed.attention[k] > 0).map((k) => ({
        key: k,
        text: copy.attention[k](feed.attention[k]),
        href: ATTENTION_LINK[k](),
      }))
    : []
  const empty = feed !== null && attention.length === 0 && feed.events.length === 0

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger
        aria-label={unread > 0 ? `${copy.label}, ${copy.unread(unread)}` : copy.label}
        className={cn(className, 'relative')}
      >
        <Bell className="size-[1.125rem]" strokeWidth={1.6} />
        {unread > 0 || attention.length > 0 ? (
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-1.5 right-1.5 size-2 rounded-full ring-2 ring-card',
              unread > 0 ? 'bg-danger' : 'bg-warning',
            )}
          />
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex max-h-[28rem] w-[22rem] flex-col gap-3 overflow-y-auto"
      >
        <p className="text-body-strong">{copy.label}</p>
        {failed && !feed ? <p className="text-body text-muted-foreground">{copy.failed}</p> : null}
        {empty ? <p className="text-body text-muted-foreground">{copy.empty}</p> : null}
        {attention.length > 0 ? (
          <section className="flex flex-col gap-1">
            <p className="text-caption font-medium text-muted-foreground">
              {copy.attentionHeading}
            </p>
            {attention.map((a) => (
              <Link
                key={a.key}
                href={a.href}
                className="rounded-md bg-warning-soft px-2.5 py-2 text-body text-foreground transition-colors hover:bg-warning-soft/70"
              >
                {a.text}
              </Link>
            ))}
          </section>
        ) : null}
        {feed && feed.events.length > 0 ? (
          <section className="flex flex-col gap-0.5">
            <p className="text-caption font-medium text-muted-foreground">{copy.recentHeading}</p>
            {feed.events.map((e) => (
              <Link
                key={`${e.kind}:${e.id}`}
                href={eventHref(e)}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-1.5 size-1.5 shrink-0 rounded-full',
                    e.at > seen ? 'bg-primary' : 'bg-transparent',
                  )}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-body text-foreground">{eventText(e)}</span>
                  <RelativeTime value={e.at} className="text-caption text-muted-foreground" />
                </span>
              </Link>
            ))}
          </section>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
