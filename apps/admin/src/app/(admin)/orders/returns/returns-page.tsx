'use client'

import type { ReturnReason } from '@commerce/core/returns'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import PillTabs from '@/components/layout/pill-tabs'
import RelativeTime from '@/components/layout/relative-time'
import StatusLabel from '@/components/status/status-label'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { returnsContent as copy } from '@/data/returns'
import { api } from '@/lib/api-client'
import { LIST_PER_PAGE, type ListQuery, sameListQuery } from '@/lib/list-query'
import { formatPaise } from '@/lib/money'
import { RETURN_LIST_FILTERS, type ReturnListFilter, returnListFilter } from '@/lib/return-filter'

type ListResult = Awaited<ReturnType<typeof api.returns.list>>
type Item = ListResult['items'][number]
type Counts = Awaited<ReturnType<typeof api.returns.counts>>

export type ReturnsInitial = {
  query: ListQuery<ReturnListFilter>
  result: ListResult
  counts: Counts
}

const reasonOf = (i: Item): string =>
  i.kind === 'rto'
    ? copy.rtoReason
    : i.reason
      ? (copy.reasons[i.reason as ReturnReason] ?? i.reason)
      : ''

const columns: ResourceColumnSpec<Item>[] = [
  {
    id: 'return',
    title: copy.columns.return,
    hideable: false,
    sortValue: (r) => r.number,
    className: 'w-32',
    render: (r) => (
      <span className="flex flex-col text-left">
        <span className="font-medium text-ink-strong tabular-nums">{r.label}</span>
        <span className="text-caption text-muted-foreground">{copy.kind[r.kind]}</span>
      </span>
    ),
  },
  {
    id: 'order',
    title: copy.columns.order,
    sortValue: (r) => r.orderNumber,
    render: (r) => <span className="tabular-nums">#{r.orderNumber}</span>,
  },
  {
    id: 'customer',
    title: copy.columns.customer,
    align: 'start',
    className: 'whitespace-normal',
    render: (r) => <span className="line-clamp-1">{r.customerName ?? r.email ?? copy.guest}</span>,
  },
  {
    id: 'reason',
    title: copy.columns.reason,
    align: 'start',
    className: 'whitespace-normal',
    render: (r) => <span className="line-clamp-1 text-muted-foreground">{reasonOf(r)}</span>,
  },
  {
    id: 'items',
    title: copy.columns.items,
    sortValue: (r) => r.items,
    render: (r) => <span className="tabular-nums">{copy.itemCount(r.items)}</span>,
  },
  {
    id: 'value',
    title: copy.columns.value,
    align: 'end',
    sortValue: (r) => r.valuePaise,
    render: (r) => <span className="tabular-nums">{formatPaise(r.valuePaise)}</span>,
  },
  {
    id: 'status',
    title: copy.columns.status,
    sortValue: (r) => r.status,
    render: (r) => (
      <StatusLabel
        kind="return"
        value={r.status}
        label={r.kind === 'rto' ? copy.rtoStatus[r.status] : undefined}
      />
    ),
  },
  {
    id: 'requested',
    title: copy.columns.requested,
    sortValue: (r) => new Date(r.requestedAt).getTime(),
    render: (r) => <RelativeTime value={r.requestedAt} />,
  },
]

function fetchReturns(q: ListQuery<ReturnListFilter>) {
  return api.returns.list({
    page: q.page,
    perPage: LIST_PER_PAGE,
    search: q.query || undefined,
    ...returnListFilter(q.status),
  })
}

function ReturnsContent({ initial }: { initial: ReturnsInitial }) {
  // Hooks
  const [{ page, query, status }, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(RETURN_LIST_FILTERS),
    },
    { shallow: true },
  )
  const [items, setItems] = useState<Item[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (sameListQuery({ page, query, status }, initial.query)) return
    let cancelled = false
    setLoading(true)
    fetchReturns({ page, query, status })
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, query, status, initial.query])

  // Render logic
  const c = initial.counts
  const counts: Record<ReturnListFilter, number | undefined> = {
    requested: c.requested,
    inProgress: c.inProgress,
    received: c.received,
    done: undefined,
    rto: c.rto,
  }

  return (
    <PageBody width="frame" className="gap-6">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      <ResourceTable
        size="frame"
        resourceName={copy.resource}
        columns={columns}
        items={items}
        getId={(r) => r.id}
        href={(r) => `/orders/returns/${r.id}`}
        loading={loading}
        query={query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', status: null, page: 1 })}
        tabs={
          <PillTabs<ReturnListFilter | null>
            value={status}
            onChange={(s) => setQ({ status: s, page: 1 })}
            tabs={[
              { value: null, label: copy.tabs.all, count: c.all },
              ...RETURN_LIST_FILTERS.map((s) => ({
                value: s,
                label: copy.tabs[s],
                ...(counts[s] !== undefined ? { count: counts[s] } : {}),
              })),
            ]}
          />
        }
        page={page}
        perPage={LIST_PER_PAGE}
        total={total}
        onPageChange={(page) => setQ({ page })}
        empty={{ heading: copy.empty, body: copy.subtitle }}
      />
    </PageBody>
  )
}

export default function ReturnsPage({ initial }: { initial: ReturnsInitial }) {
  return (
    <Suspense>
      <ReturnsContent initial={initial} />
    </Suspense>
  )
}
