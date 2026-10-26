'use client'

import type { InboxView } from '@commerce/core/inbox'
import { Settings } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import { inboxConversationsContent } from '@/data/inbox-conversations'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type InboxFiltersProps = {
  view: InboxView
  counts: Record<InboxView, number> | null
  onChange: (view: InboxView) => void
  className?: string
}

/** Open, the AI's hand-offs, Closed and All first, then the narrower views, as in Shopify Inbox. */
const MAIN: InboxView[] = ['open', 'needs_person', 'closed', 'all']
const MORE: InboxView[] = ['mine', 'unassigned', 'unread', 'blocked']

/** The inbox's left rail: the views with their counts, and Settings at the bottom. */
export default function InboxFilters({ view, counts, onChange, className }: InboxFiltersProps) {
  // Hooks
  const copy = useCopy(inboxConversationsContent)

  // Helpers
  const row = (v: InboxView) => (
    <li key={v}>
      <button
        type="button"
        aria-current={view === v ? 'page' : undefined}
        onClick={() => onChange(v)}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-2 rounded-md px-2.5 text-left text-body transition-[background-color,color]',
          view === v
            ? 'bg-accent font-medium text-accent-foreground'
            : 'text-foreground hover:bg-accent/60',
        )}
      >
        <span className="truncate">{copy.filters[v]}</span>
        {counts && counts[v] > 0 ? (
          <span className="text-caption tabular-nums text-muted-foreground">{counts[v]}</span>
        ) : null}
      </button>
    </li>
  )

  // Render logic
  const f = copy.filters

  return (
    <nav aria-label={f.title} className={cn('flex flex-col gap-4 p-3', className)}>
      <p className="px-2.5 text-eyebrow text-muted-foreground">{f.title}</p>
      <ul className="flex flex-col gap-0.5">{MAIN.map(row)}</ul>
      <ul className="flex flex-col gap-0.5 border-t border-hairline pt-3">{MORE.map(row)}</ul>
      <div className="mt-auto flex flex-col gap-0.5 border-t border-hairline pt-3">
        <Link
          href={routes.salesChannels.inboxQuickReplies()}
          className="flex h-8 items-center rounded-md px-2.5 text-body text-foreground hover:bg-accent/60"
        >
          {f.quickReplies}
        </Link>
        <Link
          href={routes.salesChannels.inboxSettings()}
          className="flex h-8 items-center gap-2 rounded-md px-2.5 text-body text-foreground hover:bg-accent/60"
        >
          <Settings className="size-4" aria-hidden="true" />
          {f.settings}
        </Link>
      </div>
    </nav>
  )
}
