'use client'

import type { ReturnReason } from '@commerce/core/returns'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useRef, useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import OrderChip from '@/components/orders/order-chip'
import OrdersListFrame from '@/components/orders/orders-list-frame'
import RowMenu from '@/components/orders/row-menu'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { returnsContent } from '@/data/returns'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'
import { type ListQuery, sameListQuery } from '@/lib/list-query'
import { RETURN_LIST_FILTERS, type ReturnListFilter, returnListFilter } from '@/lib/return-filter'
import { routes } from '@/lib/routes'
import { parseRowsPerPage } from '@/lib/rows-per-page'

type ListResult = Awaited<ReturnType<typeof api.returns.list>>
type Item = ListResult['items'][number]
type Counts = Awaited<ReturnType<typeof api.returns.counts>>

export type ReturnsInitial = {
  query: ListQuery<ReturnListFilter>
  perPage: number
  result: ListResult
  counts: Counts
}

const reasonOf = (copy: typeof returnsContent, i: Item): string =>
  i.kind === 'rto'
    ? copy.rtoReason
    : i.reason
      ? (copy.reasons[i.reason as ReturnReason] ?? i.reason)
      : ''

function returnColumns(copy: typeof returnsContent, fmt: Formatters): ResourceColumnSpec<Item>[] {
  return [
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
      render: (r) => (
        <span className="line-clamp-1">{r.customerName ?? r.email ?? copy.guest}</span>
      ),
    },
    {
      id: 'reason',
      title: copy.columns.reason,
      align: 'start',
      className: 'whitespace-normal',
      render: (r) => (
        <span className="line-clamp-1 text-muted-foreground">{reasonOf(copy, r)}</span>
      ),
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
      render: (r) => <span className="font-medium tabular-nums">{fmt.money(r.valuePaise)}</span>,
    },
    {
      id: 'status',
      title: copy.columns.status,
      sortValue: (r) => r.status,
      align: 'center',
      render: (r) => (
        <OrderChip
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
      render: (r) => <span className="tabular-nums">{fmt.when(r.requestedAt)}</span>,
    },
  ]
}

function fetchReturns(q: ListQuery<ReturnListFilter>, perPage: number) {
  return api.returns.list({
    page: q.page,
    perPage,
    search: q.query || undefined,
    ...returnListFilter(q.status),
  })
}

function ReturnsContent({ initial }: { initial: ReturnsInitial }) {
  // Hooks
  const copy = useCopy(returnsContent)
  const fmt = useFormat()
  const [{ page, query, status, perPage: rawPerPage }, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(RETURN_LIST_FILTERS),
      perPage: parseAsInteger.withDefault(initial.perPage),
    },
    { shallow: true },
  )
  const [items, setItems] = useState<Item[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)

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
    fetchReturns({ page, query, status }, size)
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

  // Render logic
  const perPage = parseRowsPerPage(rawPerPage)
  const c = initial.counts
  const counts: Record<ReturnListFilter, number | undefined> = {
    requested: c.requested,
    inProgress: c.inProgress,
    received: c.received,
    done: undefined,
    rto: c.rto,
  }

  return (
    <OrdersListFrame
      title={copy.title}
      summary={c.requested > 0 ? copy.needDecision(c.requested) : copy.subtitle}
      actions={
        <Button
          variant="outline"
          render={<Link href={routes.settings.returns()} />}
          nativeButton={false}
        >
          {copy.rules}
        </Button>
      }
    >
      <ResourceTable
        resourceName={copy.resource}
        columns={returnColumns(copy, fmt)}
        items={items}
        getId={(r) => r.id}
        href={(r) => routes.orders.returnDetail(r.id)}
        rowActions={(r) => (
          <RowMenu items={[{ label: copy.openReturn, href: routes.orders.returnDetail(r.id) }]} />
        )}
        loading={loading}
        query={query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', status: null, page: 1 })}
        tabs={
          <PillTabs<ReturnListFilter | null>
            variant="segmented"
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
        perPage={perPage}
        total={total}
        onPageChange={(page) => setQ({ page })}
        onPerPageChange={(n) => setQ({ perPage: n, page: 1 })}
        empty={{ heading: copy.empty, body: copy.subtitle }}
      />
    </OrdersListFrame>
  )
}

export default function ReturnsPage({ initial }: { initial: ReturnsInitial }) {
  return (
    <Suspense>
      <ReturnsContent initial={initial} />
    </Suspense>
  )
}
