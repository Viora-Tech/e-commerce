'use client'

import type { ActivityAttention, ActivityEvent, ActivityFeed } from '@commerce/core'
import {
  Bell,
  CircleAlert,
  type IconComponent,
  ImageIcon,
  Inbox,
  Package,
  PackageX,
  ReceiptIcon,
  ShoppingBag,
  Undo,
} from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { useEffect, useState } from 'react'
import { activityContent } from '@/data/activity'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ActivityRow from './activity-row'
import IconBadge from './icon-badge'
import RelativeTime from './relative-time'

type ActivityBellProps = {
  /** Whose "seen" mark this is: the bell remembers it per member in this browser. */
  memberKey: string
  /** The trigger's classes (the top bar's round icon button). */
  className: string
}

type Tone = 'success' | 'warning' | 'info' | 'danger' | 'neutral'

const POLL_MS = 60_000

const SKELETON_ROWS = ['first', 'second', 'third'] as const

const ATTENTION: Record<
  keyof ActivityAttention,
  { href: () => string; icon: IconComponent; tone: Tone }
> = {
  refundsFailed: { href: () => routes.orders.list(), icon: CircleAlert, tone: 'danger' },
  refundsNeeded: { href: () => routes.orders.list(), icon: ReceiptIcon, tone: 'danger' },
  returnsRequested: { href: () => routes.orders.returns(), icon: Undo, tone: 'warning' },
  outOfStock: { href: () => routes.stock.inventory(), icon: PackageX, tone: 'warning' },
  lowStock: { href: () => routes.stock.inventory(), icon: Package, tone: 'neutral' },
  mediaFailed: { href: () => routes.content.files(), icon: ImageIcon, tone: 'neutral' },
}

const ATTENTION_ORDER: readonly (keyof ActivityAttention)[] = [
  'refundsFailed',
  'refundsNeeded',
  'returnsRequested',
  'outOfStock',
  'lowStock',
  'mediaFailed',
]

const EVENT: Record<ActivityEvent['kind'], { icon: IconComponent; tone: Tone }> = {
  order: { icon: ShoppingBag, tone: 'success' },
  refund_needed: { icon: ReceiptIcon, tone: 'danger' },
  return: { icon: Undo, tone: 'info' },
}

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
 * what happened in the last week, each line a link to where it is handled. New events stay
 * highlighted while the panel is open and count as read once it closes (or on "Mark all as
 * read"); refreshed every minute while the tab is visible.
 */
export default function ActivityBell({ memberKey, className }: ActivityBellProps) {
  // Hooks
  const copy = useCopy(activityContent)
  const format = useFormat()
  const [feed, setFeed] = useState<ActivityFeed | null>(null)
  const [failed, setFailed] = useState(false)
  const [seen, setSeen] = useState('')
  const [open, setOpen] = useState(false)

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
  const markAllRead = () => {
    const newest = feed?.events[0]?.at
    if (!newest) return
    writeSeen(seenKey(memberKey), newest)
    setSeen(newest)
  }

  const eventDetail = (e: ActivityEvent) =>
    e.kind === 'order'
      ? format.money(e.totalPaise)
      : e.kind === 'refund_needed'
        ? format.money(e.amountPaise)
        : null

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) markAllRead()
  }

  const handleNavigate = () => handleOpenChange(false)

  // Render logic
  const unread = feed ? feed.events.filter((e) => e.at > seen).length : 0
  const attention = feed ? ATTENTION_ORDER.filter((k) => feed.attention[k] > 0) : []
  const empty = feed !== null && attention.length === 0 && feed.events.length === 0
  const urgent = attention.some((k) => ATTENTION[k].tone === 'danger')

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        aria-label={unread > 0 ? `${copy.label}, ${copy.unread(unread)}` : copy.label}
        className={cn(className, 'relative')}
      >
        <Bell className="size-[1.125rem]" strokeWidth={1.6} />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.625rem] leading-none font-semibold text-danger-foreground tabular-nums ring-2 ring-card"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : attention.length > 0 ? (
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-1.5 right-1.5 size-2 rounded-full ring-2 ring-card',
              urgent ? 'bg-danger' : 'bg-warning',
            )}
          />
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="flex w-[24rem] flex-col gap-0 p-0">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="flex items-center gap-2">
            <span className="text-body-strong text-foreground">{copy.label}</span>
            {unread > 0 ? (
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-caption font-medium text-primary tabular-nums">
                {copy.unread(unread)}
              </span>
            ) : null}
          </span>
          {unread > 0 ? (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              {copy.markAllRead}
            </Button>
          ) : null}
        </header>

        <div className="flex max-h-[30rem] flex-col gap-3 overflow-y-auto p-2">
          {failed && !feed ? (
            <p className="px-3 py-6 text-center text-body text-muted-foreground">{copy.failed}</p>
          ) : null}

          {feed === null && !failed
            ? SKELETON_ROWS.map((row) => (
                <div key={row} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="size-8 shrink-0 animate-pulse rounded-xl bg-muted" />
                  <span className="flex flex-1 flex-col gap-1.5">
                    <span className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                    <span className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
                  </span>
                </div>
              ))
            : null}

          {empty ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <IconBadge icon={Inbox} />
              <span className="flex flex-col gap-1">
                <span className="text-body-strong text-foreground">{copy.empty.title}</span>
                <span className="text-body text-muted-foreground">{copy.empty.body}</span>
              </span>
            </div>
          ) : null}

          {attention.length > 0 ? (
            <section className="flex flex-col">
              <h3 className="px-3 pt-1 pb-1.5 text-caption font-medium text-muted-foreground">
                {copy.attentionHeading}
              </h3>
              {attention.map((k) => (
                <ActivityRow
                  key={k}
                  href={ATTENTION[k].href()}
                  icon={ATTENTION[k].icon}
                  tone={ATTENTION[k].tone}
                  title={copy.attention[k].title(feed?.attention[k] ?? 0)}
                  detail={copy.attention[k].detail}
                  onNavigate={handleNavigate}
                />
              ))}
            </section>
          ) : null}

          {feed && feed.events.length > 0 ? (
            <section className="flex flex-col">
              <h3 className="px-3 pt-1 pb-1.5 text-caption font-medium text-muted-foreground">
                {copy.recentHeading}
              </h3>
              {feed.events.map((e) => (
                <ActivityRow
                  key={`${e.kind}:${e.id}`}
                  href={eventHref(e)}
                  icon={EVENT[e.kind].icon}
                  tone={EVENT[e.kind].tone}
                  title={copy.event[e.kind](e.number)}
                  detail={eventDetail(e)}
                  aside={<RelativeTime value={e.at} className="whitespace-nowrap" />}
                  unread={e.at > seen}
                  onNavigate={handleNavigate}
                />
              ))}
            </section>
          ) : null}
        </div>

        {feed && !empty ? (
          <footer className="border-t border-border px-4 py-2.5 text-caption text-muted-foreground">
            {copy.footer}
          </footer>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
