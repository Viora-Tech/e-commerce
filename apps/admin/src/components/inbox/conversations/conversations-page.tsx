'use client'

import {
  type ConversationStatus,
  INBOX_VIEWS,
  type InboxConnectionEvent,
  type InboxView,
} from '@commerce/core/inbox'
import { permissions } from '@commerce/core/permissions'
import { MessageSquare } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/layout/empty-state'
import { inboxConversationsContent } from '@/data/inbox-conversations'
import { useCopy } from '@/hooks/use-copy'
import { useInboxLive } from '@/hooks/use-inbox-live'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ConversationList, { type ConversationRow } from './conversation-list'
import InboxFilters from './inbox-filters'
import ThreadPane from './thread-pane'

type ConversationsPageProps = {
  initialView: string | null
  initialId: string | null
}

type Cursor = { lastMessageAt: Date; id: string } | null
type StatusChange = { seq: number; id: string; status: 'open' | 'closed' }

/** A burst of live events refreshes the list once. */
const REFRESH_DELAY_MS = 400
const SEARCH_DELAY_MS = 250

const viewOf = (raw: string | null): InboxView => INBOX_VIEWS.find((v) => v === raw) ?? 'open'

/** Whether a conversation with this status still belongs in the view (closing changes nothing else). */
const inView = (view: InboxView, status: ConversationStatus): boolean => {
  if (view === 'all') return status !== 'blocked'
  if (view === 'closed' || view === 'blocked') return status === view
  return status === 'open'
}

/** Rows after a close or reopen: the row leaves a view it no longer belongs to. */
const withStatus = (
  rows: ConversationRow[] | null,
  view: InboxView,
  id: string,
  status: 'open' | 'closed',
): ConversationRow[] | null =>
  rows?.flatMap((r) => {
    if (r.id !== id) return [r]
    return inView(view, status) ? [{ ...r, status }] : []
  }) ?? null

/**
 * Sales channels › Inbox › Conversations, Shopify Inbox's three panes: the views, the list,
 * and the thread with its customer panel. Below `md` it is one pane at a time with a back
 * button; the customer panel is inline only on wide screens and a dialog otherwise.
 */
export default function ConversationsPage({ initialView, initialId }: ConversationsPageProps) {
  // Hooks
  const copy = useCopy(inboxConversationsContent)
  const { hasPermission } = usePermissions()
  const [view, setView] = useState<InboxView>(viewOf(initialView))
  const [selectedId, setSelectedId] = useState<string | null>(initialId)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<ConversationRow[] | null>(null)
  const [cursor, setCursor] = useState<Cursor>(null)
  const [counts, setCounts] = useState<Record<InboxView, number> | null>(null)
  const [assignees, setAssignees] = useState<
    { userId: string; name: string | null; email: string }[]
  >([])
  const [quickReplies, setQuickReplies] = useState<
    { id: string; shortcut: string; title: string; body: string }[]
  >([])
  const [live, setLive] = useState<{ seq: number; event: InboxConnectionEvent } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [aiHelp, setAiHelp] = useState(false)
  const [statusChange, setStatusChange] = useState<StatusChange | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useInboxLive((event) => {
    setLive((l) => ({ seq: (l?.seq ?? 0) + 1, event }))
    if (event.type === 'message' || event.type === 'conversation') scheduleRefresh()
  })

  useEffect(() => {
    api.inbox
      .assignees()
      .then(setAssignees)
      .catch(() => undefined)
    api.inbox.quickReplies
      .list()
      .then(setQuickReplies)
      .catch(() => undefined)
    api.inbox
      .aiAvailable()
      .then((a) => setAiHelp(a.available))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (reloadKey < 0) return
    let alive = true
    Promise.all([api.inbox.list({ view, search: query || undefined }), api.inbox.counts()]).then(
      ([list, c]) => {
        if (!alive) return
        setRows(list.rows)
        setCursor(list.nextCursor)
        setCounts(c)
      },
    )
    return () => {
      alive = false
    }
  }, [view, query, reloadKey])

  useEffect(() => {
    const params = new URLSearchParams()
    if (selectedId) params.set('id', selectedId)
    if (view !== 'open') params.set('view', view)
    const qs = params.toString()
    window.history.replaceState(
      null,
      '',
      `${routes.salesChannels.inboxConversations()}${qs ? `?${qs}` : ''}`,
    )
  }, [selectedId, view])

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    },
    [],
  )

  // Helpers
  const scheduleRefresh = () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => setReloadKey((k) => k + 1), REFRESH_DELAY_MS)
  }
  const nameOfMember = (userId: string) => {
    const a = assignees.find((m) => m.userId === userId)
    return a?.name ?? a?.email ?? '—'
  }

  const announce = (id: string, status: 'open' | 'closed') =>
    setStatusChange((s) => ({ seq: (s?.seq ?? 0) + 1, id, status }))
  /** Close or reopen at once (list, counts, thread), then save; a failure puts it back. */
  const changeStatus = async (
    id: string,
    next: 'open' | 'closed',
    prev: 'open' | 'closed',
    undoable = true,
  ) => {
    setRows((r) => withStatus(r, view, id, next))
    setCounts((c) => (c ? { ...c, [prev]: Math.max(0, c[prev] - 1), [next]: c[next] + 1 } : c))
    announce(id, next)
    try {
      await api.inbox.setStatus({ id, status: next })
    } catch (err) {
      announce(id, prev)
      setReloadKey((k) => k + 1)
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
      return
    }
    scheduleRefresh()
    if (!undoable) return
    toast.success(next === 'closed' ? copy.thread.closedToast : copy.thread.reopenedToast, {
      action: {
        label: copy.thread.undo,
        onClick: () => {
          changeStatus(id, prev, next, false).catch(() => undefined)
        },
      },
    })
  }

  // Event handlers
  const handleView = (next: InboxView) => {
    setView(next)
    setRows(null)
  }
  const handleMore = async () => {
    if (!cursor) return
    const next = await api.inbox.list({ view, search: query || undefined, cursor })
    setRows((r) => [...(r ?? []), ...next.rows])
    setCursor(next.nextCursor)
  }

  // Render logic
  const showThread = selectedId !== null
  const canReply = hasPermission(permissions.INBOX_REPLY)

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] min-h-[30rem] overflow-hidden rounded-2xl surface-card">
      <InboxFilters
        view={view}
        counts={counts}
        onChange={handleView}
        className="hidden w-52 shrink-0 border-r border-hairline lg:flex"
      />
      <div
        className={cn(
          'w-full shrink-0 flex-col border-r border-hairline md:w-80',
          showThread ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="border-b border-hairline p-3 lg:hidden">
          <NativeSelect
            aria-label={copy.filters.title}
            value={view}
            onChange={(e) => handleView(viewOf(e.target.value))}
          >
            {INBOX_VIEWS.map((v) => (
              <NativeSelectOption key={v} value={v}>
                {copy.filters[v]}
                {counts && counts[v] > 0 ? ` (${counts[v]})` : ''}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <ConversationList
          rows={rows}
          selectedId={selectedId}
          search={search}
          hasMore={cursor !== null}
          showViewClosed={view === 'open'}
          canClose={canReply}
          nameOfMember={nameOfMember}
          onSearch={setSearch}
          onSelect={setSelectedId}
          onMore={handleMore}
          onViewClosed={() => handleView('closed')}
          onSetStatus={(id, next, prev) => changeStatus(id, next, prev).catch(() => undefined)}
          className="min-h-0 flex-1"
        />
      </div>
      <div className={cn('min-w-0 flex-1', showThread ? 'flex' : 'hidden md:flex')}>
        {selectedId ? (
          <ThreadPane
            key={selectedId}
            conversationId={selectedId}
            live={live}
            assignees={assignees}
            quickReplies={quickReplies}
            aiHelp={aiHelp}
            nameOfMember={nameOfMember}
            statusChange={statusChange}
            onBack={() => setSelectedId(null)}
            onChanged={scheduleRefresh}
            onSetStatus={(next, prev) =>
              changeStatus(selectedId, next, prev).catch(() => undefined)
            }
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState icon={MessageSquare} body={copy.thread.placeholder} />
          </div>
        )}
      </div>
    </div>
  )
}
