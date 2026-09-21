'use client'

import { cn } from '@commerce/ui/lib/utils'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { CustomerAvatar } from '@/components/customers/customer-avatar'
import { type CustomerStats, CustomerTiles } from '@/components/customers/customer-tiles'
import { PageBody } from '@/components/layout/page-body'
import { type ResourceColumnSpec, ResourceTable } from '@/components/table/resource-table'
import { CUSTOMER_SEGMENTS, type CustomerSegment, customersContent } from '@/data/customers'
import { api } from '@/lib/api-client'
import { LIST_PER_PAGE, type ListQuery, sameListQuery } from '@/lib/list-query'
import { formatPaise } from '@/lib/money'

type ListResult = Awaited<ReturnType<typeof api.customers.list>>
type Item = ListResult['items'][number]

/** First page, tiles and the all-customers count rendered on the server so nothing paints empty. */
export type CustomersInitial = {
  query: ListQuery<CustomerSegment>
  result: ListResult
  stats: CustomerStats
  allCount: number
}

const PER_PAGE = LIST_PER_PAGE

/* Frame 5:2561: soft-green track with 4px inset; the active tab is a white 6px pill. */
const TAB =
  'flex h-7 items-center gap-1 rounded-[0.375rem] px-2.5 text-xs font-medium leading-4 text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const TAB_ACTIVE = 'bg-card text-foreground'

/* Frame 5:2617 writes dates as 01-01-2025. */
const date = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
const formatDate = (d: Date) => date.format(d).replaceAll('/', '-')

type Query = ListQuery<CustomerSegment>

function fetchCustomers(q: Query) {
  return api.customers.list({
    page: q.page,
    perPage: PER_PAGE,
    search: q.query || undefined,
    segment: q.status ?? undefined,
  })
}

/* Product-cell pattern from 5:2612: 32px picture slot, name beside it. */
function NameCell({ item }: { item: Item }) {
  return (
    <span className="flex items-center gap-3 text-left">
      <CustomerAvatar name={item.name} email={item.email} />
      <span className="line-clamp-2 text-body-strong">{item.name ?? customersContent.unnamed}</span>
    </span>
  )
}

function TagsCell({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="text-muted-foreground-soft">-</span>
  return (
    <span className="flex flex-wrap justify-center gap-1">
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-foreground">
          {t}
        </span>
      ))}
    </span>
  )
}

const columns: ResourceColumnSpec<Item>[] = [
  {
    id: 'name',
    title: customersContent.columns.name,
    sortValue: (c) => c.name ?? c.email ?? '',
    hideable: false,
    align: 'start',
    className: 'w-56 px-3 whitespace-normal',
    render: (c) => <NameCell item={c} />,
  },
  {
    id: 'email',
    title: customersContent.columns.email,
    sortValue: (c) => c.email ?? '',
    render: (c) => c.email ?? '-',
  },
  {
    id: 'phone',
    title: customersContent.columns.phone,
    render: (c) => <span className="tabular-nums">{c.phone ?? '-'}</span>,
  },
  {
    id: 'orders',
    title: customersContent.columns.orders,
    sortValue: (c) => c.orderCount,
    render: (c) => <span className="tabular-nums">{c.orderCount}</span>,
  },
  {
    id: 'spent',
    title: customersContent.columns.spent,
    sortValue: (c) => c.spentPaise,
    render: (c) => <span className="tabular-nums">{formatPaise(c.spentPaise)}</span>,
  },
  {
    id: 'lastOrder',
    title: customersContent.columns.lastOrder,
    sortValue: (c) => (c.lastOrderAt ? new Date(c.lastOrderAt).getTime() : 0),
    render: (c) =>
      c.lastOrderAt ? (
        <span className="tabular-nums">{formatDate(new Date(c.lastOrderAt))}</span>
      ) : (
        <span className="text-muted-foreground">{customersContent.never}</span>
      ),
  },
  {
    id: 'tags',
    title: customersContent.columns.tags,
    className: 'whitespace-normal',
    render: (c) => <TagsCell tags={c.tags} />,
  },
]

type TabsProps = {
  value: CustomerSegment | null
  allCount: number
  onChange: (s: CustomerSegment | null) => void
}

function SegmentTabs({ value, allCount, onChange }: TabsProps) {
  return (
    <div role="tablist" className="flex items-center rounded-lg bg-primary-soft p-1">
      <button
        type="button"
        role="tab"
        aria-selected={value === null}
        onClick={() => onChange(null)}
        className={cn(TAB, value === null && TAB_ACTIVE)}
      >
        {customersContent.tabs.all}
        <span className="text-xs font-semibold text-primary tabular-nums">({allCount})</span>
      </button>
      {CUSTOMER_SEGMENTS.map((s) => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={value === s}
          onClick={() => onChange(s)}
          className={cn(TAB, value === s && TAB_ACTIVE)}
        >
          {customersContent.tabs[s]}
        </button>
      ))}
    </div>
  )
}

function CustomersContent({ initial }: { initial: CustomersInitial }) {
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(CUSTOMER_SEGMENTS),
    },
    { shallow: true },
  )
  const [items, setItems] = useState<Item[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)

  const { page, query, status } = q

  useEffect(() => {
    if (sameListQuery({ page, query, status }, initial.query)) return
    let cancelled = false
    setLoading(true)
    fetchCustomers({ page, query, status })
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

  return (
    <PageBody className="gap-6">
      <div className="flex h-9 items-center justify-between">
        <h1 className="text-page-title">{customersContent.heading}</h1>
      </div>
      <CustomerTiles stats={initial.stats} />
      <div className="-mt-1">
        <ResourceTable
          resourceName={customersContent.resource}
          columns={columns}
          items={items}
          getId={(c) => c.id}
          href={(c) => `/customers/${c.id}`}
          loading={loading}
          query={q.query}
          onQueryChange={(query) => setQ({ query, page: 1 })}
          onClearAll={() => setQ({ query: '', status: null, page: 1 })}
          tabs={
            <SegmentTabs
              value={q.status}
              allCount={initial.allCount}
              onChange={(s) => setQ({ status: s, page: 1 })}
            />
          }
          page={q.page}
          perPage={PER_PAGE}
          total={total}
          onPageChange={(page) => setQ({ page })}
          selectable={false}
          empty={customersContent.empty}
        />
      </div>
    </PageBody>
  )
}

export function CustomersPage({ initial }: { initial: CustomersInitial }) {
  return (
    <Suspense>
      <CustomersContent initial={initial} />
    </Suspense>
  )
}
