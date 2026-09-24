'use client'

import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import Link from 'next/link'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import RelativeTime from '@/components/layout/relative-time'
import StatusLabel from '@/components/status/status-label'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { draftsContent as copy } from '@/data/drafts'
import { api } from '@/lib/api-client'
import { LIST_PER_PAGE, type ListQuery, sameListQuery } from '@/lib/list-query'
import { formatPaise } from '@/lib/money'
import { usePrimaryAction } from '@/lib/primary-action'

type ListResult = Awaited<ReturnType<typeof api.orders.listDrafts>>
type Item = ListResult['items'][number]

export type DraftsInitial = { query: ListQuery<never>; result: ListResult }

const columns: ResourceColumnSpec<Item>[] = [
  {
    id: 'number',
    title: copy.columns.number,
    sortValue: (d) => d.number,
    hideable: false,
    className: 'w-28',
    render: (d) => <span className="tabular-nums">#{d.number}</span>,
  },
  {
    id: 'customer',
    title: copy.columns.customer,
    align: 'start',
    sortValue: (d) => d.customerName ?? d.email ?? '',
    render: (d) => (
      <span className="block truncate">{d.customerName ?? d.email ?? copy.guest}</span>
    ),
  },
  {
    id: 'items',
    title: copy.columns.items,
    sortValue: (d) => d.lineCount,
    render: (d) => <span className="tabular-nums">{copy.itemCount(d.lineCount)}</span>,
  },
  {
    id: 'total',
    title: copy.columns.total,
    sortValue: (d) => d.totalPaise,
    render: (d) => <span className="tabular-nums">{formatPaise(d.totalPaise)}</span>,
  },
  {
    id: 'created',
    title: copy.columns.created,
    sortValue: (d) => new Date(d.createdAt).getTime(),
    render: (d) => <RelativeTime value={d.createdAt} />,
  },
  {
    id: 'status',
    title: copy.columns.status,
    render: (d) => <StatusLabel kind="draft" value={d.invoiceSentAt ? 'invoiceSent' : 'open'} />,
  },
]

function DraftsContent({ initial }: { initial: DraftsInitial }) {
  // Hooks
  usePrimaryAction('/orders/drafts/new')
  const [{ page, query }, setQ] = useQueryStates(
    { query: parseAsString.withDefault(''), page: parseAsInteger.withDefault(1) },
    { shallow: true },
  )
  const [items, setItems] = useState<Item[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (sameListQuery({ page, query, status: null }, initial.query)) return
    let cancelled = false
    setLoading(true)
    api.orders
      .listDrafts({ page, perPage: LIST_PER_PAGE, search: query || undefined })
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, query, initial.query])

  // Render logic
  return (
    <PageBody width="frame" className="gap-6">
      <PageHeader
        title={copy.heading}
        subtitle={copy.intro}
        actions={
          <Tooltip>
            <TooltipTrigger
              render={
                <Button render={<Link href="/orders/drafts/new" />} nativeButton={false}>
                  <Plus />
                  {copy.create}
                </Button>
              }
            />
            <TooltipContent>
              {copy.create} <Kbd>N</Kbd>
            </TooltipContent>
          </Tooltip>
        }
      />
      <ResourceTable
        size="frame"
        resourceName={copy.resource}
        columns={columns}
        items={items}
        getId={(d) => d.id}
        href={(d) => `/orders/drafts/${d.id}`}
        loading={loading}
        query={query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', page: 1 })}
        page={page}
        perPage={LIST_PER_PAGE}
        total={total}
        onPageChange={(page) => setQ({ page })}
        empty={{ heading: copy.empty, body: copy.intro }}
      />
    </PageBody>
  )
}

export default function DraftsPage({ initial }: { initial: DraftsInitial }) {
  return (
    <Suspense>
      <DraftsContent initial={initial} />
    </Suspense>
  )
}
