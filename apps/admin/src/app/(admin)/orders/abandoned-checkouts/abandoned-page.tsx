'use client'

import { AppWindow, Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import AbandonedTiles, { type AbandonedStats } from '@/components/abandoned/abandoned-tiles'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import StatusChip from '@/components/layout/status-chip'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import RowMenu from '@/components/table/row-menu'
import ViewSelect from '@/components/table/view-select'
import { ABANDONED_LIST_FILTERS, type AbandonedListFilter, abandonedContent } from '@/data/drafts'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { type ListQuery, sameListQuery } from '@/lib/list-query'
import { routes } from '@/lib/routes'
import { parseRowsPerPage } from '@/lib/rows-per-page'

type ListResult = Awaited<ReturnType<typeof api.orders.listAbandoned>>
type Item = ListResult['items'][number]

export type AbandonedInitial = {
  query: ListQuery<AbandonedListFilter>
  perPage: number
  result: ListResult
  stats: AbandonedStats
  /** Whole-window (30 day) counts for the tabs; `stats` is the 7 day figures for the tiles. */
  counts: AbandonedStats
}

/** Figma: amber while still open, grey once a reminder went out, green once recovered. */
const STATUS_TONE = { open: 'attention', sent: 'neutral', recovered: 'success' } as const

const statusOf = (c: Item) => (c.recovered ? 'recovered' : c.recoverySentAt ? 'sent' : 'open')

function AbandonedContent({ initial }: { initial: AbandonedInitial }) {
  // Hooks
  const copy = useCopy(abandonedContent)
  const fmt = useFormat()
  const [{ page, query, status, perPage: rawPerPage }, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      status: parseAsStringLiteral(ABANDONED_LIST_FILTERS),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(initial.perPage),
    },
    { shallow: true },
  )
  const [items, setItems] = useState<Item[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState<string | null>(null)

  const hydrated = useRef(false)

  useEffect(() => {
    const size = parseRowsPerPage(rawPerPage)
    // The server's first page is used once; after any change (including back to the first
    // tab) the list is fetched again, so it never keeps another tab's rows.
    const firstRun = !hydrated.current
    hydrated.current = true
    if (
      firstRun &&
      size === initial.perPage &&
      sameListQuery({ page, query, status }, initial.query)
    )
      return
    let cancelled = false
    setLoading(true)
    api.orders
      .listAbandoned({
        page,
        perPage: size,
        sinceDays: 30,
        status: status ?? undefined,
        search: query || undefined,
      })
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, query, status, rawPerPage, initial.query, initial.perPage])

  // Event handlers
  const handleSend = async (cartId: string) => {
    setSending(cartId)
    try {
      const r = await api.orders.sendRecovery({ cartId })
      toast.success(copy.sent(r.sent))
      setItems((list) =>
        list.map((c) => (c.id === cartId ? { ...c, recoverySentAt: new Date() } : c)),
      )
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.sendFailed)
    } finally {
      setSending(null)
    }
  }

  const handleSendAll = async () => {
    const due = items.filter((c) => !c.recovered && c.email && !c.recoverySentAt)
    if (due.length === 0) {
      toast.info(copy.nothingToSend)
      return
    }
    setSending('all')
    let sent = 0
    for (const c of due) {
      try {
        await api.orders.sendRecovery({ cartId: c.id })
        sent += 1
        setItems((list) =>
          list.map((x) => (x.id === c.id ? { ...x, recoverySentAt: new Date() } : x)),
        )
      } catch {
        // One failed cart must not stop the rest; the row stays "Not recovered".
      }
    }
    setSending(null)
    toast.success(copy.remindersDone(sent))
  }

  // Render logic
  const perPage = parseRowsPerPage(rawPerPage)
  const columns: ResourceColumnSpec<Item>[] = [
    {
      id: 'contact',
      title: copy.columns.contact,
      align: 'start',
      hideable: false,
      sortValue: (c) => c.email ?? c.phone ?? '',
      render: (c) => (
        <span className="block min-w-0">
          <span className="block truncate text-body-strong text-foreground">
            {c.customerName ?? c.email ?? c.phone ?? copy.anonymous}
          </span>
          {c.email ? (
            <span className="block truncate text-caption text-muted-foreground">{c.email}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'cart',
      title: copy.columns.cart,
      sortValue: (c) => c.itemCount,
      render: (c) => (
        <span className="block min-w-0">
          <span className="block truncate text-body-strong text-foreground">
            {c.firstTitle ?? copy.itemCount(c.itemCount)}
            {c.firstTitle && c.itemCount > 1 ? ` ${copy.more(c.itemCount - 1)}` : ''}
          </span>
          <span className="block text-caption text-muted-foreground">
            {copy.itemCount(c.itemCount)}
          </span>
        </span>
      ),
    },
    {
      id: 'value',
      title: copy.columns.value,
      sortValue: (c) => c.subtotalPaise,
      align: 'end',
      render: (c) => <span className="font-medium tabular-nums">{fmt.money(c.subtotalPaise)}</span>,
    },
    {
      id: 'activity',
      title: copy.columns.activity,
      sortValue: (c) => new Date(c.updatedAt).getTime(),
      render: (c) => <span className="tabular-nums">{fmt.when(c.updatedAt)}</span>,
    },
    {
      id: 'status',
      title: copy.columns.status,
      align: 'center',
      render: (c) => (
        <StatusChip tone={STATUS_TONE[statusOf(c)]}>{copy.status[statusOf(c)]}</StatusChip>
      ),
    },
  ]

  return (
    <ProoflyListPage
      title={copy.heading}
      summary={copy.summary(
        initial.stats.carts,
        initial.stats.recovered,
        fmt.money(initial.stats.valuePaise),
      )}
      actions={
        <Button loading={sending === 'all'} onClick={handleSendAll}>
          {copy.sendReminders}
        </Button>
      }
      stats={
        <AbandonedTiles
          stats={initial.stats}
          status={status}
          onSelect={(s) => setQ({ status: s, page: 1 })}
        />
      }
    >
      <ResourceTable
        resourceName={copy.resource}
        columns={columns}
        items={items}
        getId={(c) => c.id}
        href={(c) => routes.orders.abandonedCheckout(c.id)}
        loading={loading}
        rowActions={(c) => (
          <RowMenu
            items={[
              { label: copy.view, href: routes.orders.abandonedCheckout(c.id), icon: AppWindow },
              ...(c.recovered || !c.email
                ? []
                : [{ label: copy.send, onSelect: () => handleSend(c.id), icon: Send }]),
            ]}
          />
        )}
        query={query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', status: null, page: 1 })}
        views={
          <ViewSelect<AbandonedListFilter | null>
            label={copy.viewLabel}
            value={status}
            onChange={(s) => setQ({ status: s, page: 1 })}
            formatCount={fmt.number}
            options={[
              { value: null, label: copy.tabs.all, count: initial.counts.carts },
              {
                value: 'not_recovered',
                label: copy.tabs.not_recovered,
                count: initial.counts.notRecovered,
              },
              {
                value: 'reminder_sent',
                label: copy.tabs.reminder_sent,
                count: initial.counts.remindersSent,
              },
              { value: 'recovered', label: copy.tabs.recovered, count: initial.counts.recovered },
            ]}
          />
        }
        page={page}
        perPage={perPage}
        total={total}
        onPageChange={(page) => setQ({ page })}
        onPerPageChange={(n) => setQ({ perPage: n, page: 1 })}
        empty={{ heading: copy.empty, body: copy.intro }}
      />
    </ProoflyListPage>
  )
}

export default function AbandonedPage({ initial }: { initial: AbandonedInitial }) {
  return (
    <Suspense>
      <AbandonedContent initial={initial} />
    </Suspense>
  )
}
