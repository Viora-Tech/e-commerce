'use client'

import { Search } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import EmptyState from '@/components/layout/empty-state'
import RelativeTime from '@/components/layout/relative-time'
import { inboxConversationsContent } from '@/data/inbox-conversations'
import { useCopy } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import { conversationName, initialsOf } from '@/lib/inbox-view'
import CloseButton from './close-button'

export type ConversationRow = Awaited<ReturnType<typeof api.inbox.list>>['rows'][number]

type ConversationListProps = {
  rows: ConversationRow[] | null
  selectedId: string | null
  search: string
  hasMore: boolean
  /** Shows "View closed conversations" on an empty Open list. */
  showViewClosed: boolean
  /** The member may close and reopen (a row shows the circle on hover or keyboard focus). */
  canClose: boolean
  nameOfMember: (userId: string) => string
  onSearch: (search: string) => void
  onSelect: (id: string) => void
  onMore: () => void
  onViewClosed: () => void
  onSetStatus: (id: string, next: 'open' | 'closed', prev: 'open' | 'closed') => void
  className?: string
}

/** The middle pane: search, then one row per conversation (avatar, name, preview, time, unread dot). */
export default function ConversationList({
  rows,
  selectedId,
  search,
  hasMore,
  showViewClosed,
  canClose,
  nameOfMember,
  onSearch,
  onSelect,
  onMore,
  onViewClosed,
  onSetStatus,
  className,
}: ConversationListProps) {
  // Hooks
  const copy = useCopy(inboxConversationsContent)

  // Render logic
  const l = copy.list

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="relative border-b border-hairline p-3">
        <Search
          className="pointer-events-none absolute top-1/2 left-5.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={search}
          placeholder={l.search}
          aria-label={l.search}
          className="pl-8"
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {!rows ? (
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            heading={l.allClear}
            body={l.allClearBody}
            action={
              showViewClosed ? (
                <Button variant="outline" size="sm" onClick={onViewClosed}>
                  {l.viewClosed}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="flex flex-col">
            {rows.map((r) => {
              const name = conversationName(r, copy)
              const unread = r.unreadStaff > 0
              const status = canClose && r.status !== 'blocked' ? r.status : null
              return (
                <li key={r.id} className="group relative">
                  <button
                    type="button"
                    aria-current={r.id === selectedId ? 'true' : undefined}
                    onClick={() => onSelect(r.id)}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-hairline px-3 py-3 text-left transition-[background-color]',
                      r.id === selectedId ? 'bg-accent' : 'hover:bg-accent/50',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-medium text-foreground"
                    >
                      {initialsOf(name)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'truncate text-body',
                            unread ? 'font-semibold text-ink-strong' : 'text-foreground',
                          )}
                        >
                          {name}
                        </span>
                        <RelativeTime
                          value={r.lastMessageAt}
                          className={cn(
                            'shrink-0 text-caption text-muted-foreground',
                            status && 'group-focus-within:invisible group-hover:invisible',
                          )}
                        />
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-caption text-muted-foreground">
                          {r.lastSender === 'staff' ? `${l.you}: ` : ''}
                          {r.lastSender === 'ai' ? `${l.ai}: ` : ''}
                          {r.lastMessagePreview}
                        </span>
                        {unread ? (
                          <span className="size-2 shrink-0 rounded-full bg-primary">
                            <span className="sr-only">{l.unread}</span>
                          </span>
                        ) : null}
                      </span>
                      {r.needsHuman ? (
                        <span className="w-fit rounded-full bg-warning-soft px-2 py-0.5 text-caption font-medium text-warning-foreground dark:text-warning">
                          {l.needsPerson}
                        </span>
                      ) : null}
                      {r.assigneeUserId ? (
                        <span className="truncate text-caption text-muted-foreground">
                          {l.assignedTo(nameOfMember(r.assigneeUserId))}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  {status ? (
                    <CloseButton
                      status={status}
                      onClick={() =>
                        onSetStatus(r.id, status === 'open' ? 'closed' : 'open', status)
                      }
                      className="invisible absolute top-2 right-2 group-focus-within:visible group-hover:visible"
                    />
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
        {hasMore ? (
          <div className="p-3">
            <Button variant="ghost" className="w-full" onClick={onMore}>
              {l.loadMore}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
