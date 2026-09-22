'use client'

import { describeDiscountValue } from '@commerce/core/discounts'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { SquarePlus } from 'lucide-react'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import DiscountLifecyclePill from '@/components/discounts/discount-lifecycle-pill'
import DiscountTiles, { type DiscountStats } from '@/components/discounts/discount-tiles'
import PageBody from '@/components/layout/page-body'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { DISCOUNT_LIFECYCLES, type DiscountLifecycle, discountsContent } from '@/data/discounts'
import { api } from '@/lib/api-client'
import { LIST_PER_PAGE, type ListQuery, sameListQuery } from '@/lib/list-query'

type ListResult = Awaited<ReturnType<typeof api.discounts.list>>
type Item = ListResult['items'][number]

/** First page, tiles and the all-discounts count rendered on the server so nothing paints empty. */
export type DiscountsInitial = {
  query: ListQuery<DiscountLifecycle>
  result: ListResult
  stats: DiscountStats
  allCount: number
}

type Query = ListQuery<DiscountLifecycle>

const PER_PAGE = LIST_PER_PAGE

/* Frame 5:2561: soft-green track with 4px inset; the active tab is a white 6px pill. */
const TAB =
  'flex h-7 items-center gap-1 rounded-[0.375rem] px-2.5 text-xs font-medium leading-4 text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const TAB_ACTIVE = 'bg-card text-foreground'

/* Frame 5:2617 writes dates as 01-01-2025. */
const date = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
const formatDate = (d: Date | string) => date.format(new Date(d)).replaceAll('/', '-')

function fetchDiscounts(q: Query) {
  return api.discounts.list({
    page: q.page,
    perPage: PER_PAGE,
    search: q.query || undefined,
    lifecycle: q.status ?? undefined,
  })
}

function datesLabel(item: Item): string {
  if (!item.startsAt && !item.endsAt) return discountsContent.always
  const from = item.startsAt ? formatDate(item.startsAt) : ''
  const to = item.endsAt ? formatDate(item.endsAt) : discountsContent.noEnd
  return from ? `${from} to ${to}` : to
}

function TitleCell({ item }: { item: Item }) {
  return (
    <span className="flex flex-col text-left">
      <span className="text-body-strong">{item.title}</span>
      {item.code ? (
        <span className="font-mono text-caption uppercase tracking-wide">{item.code}</span>
      ) : null}
    </span>
  )
}

const columns: ResourceColumnSpec<Item>[] = [
  {
    id: 'title',
    title: discountsContent.columns.title,
    sortValue: (d) => d.title,
    hideable: false,
    align: 'start',
    className: 'w-64 px-3 whitespace-normal',
    render: (d) => <TitleCell item={d} />,
  },
  {
    id: 'method',
    title: discountsContent.columns.method,
    render: (d) => describeDiscountValue(d),
  },
  {
    id: 'kind',
    title: discountsContent.columns.kind,
    render: (d) => discountsContent.kind[d.kind],
  },
  {
    id: 'used',
    title: discountsContent.columns.used,
    sortValue: (d) => d.usedCount,
    render: (d) => (
      <span className="tabular-nums">{discountsContent.usedOf(d.usedCount, d.usageLimit)}</span>
    ),
  },
  {
    id: 'dates',
    title: discountsContent.columns.dates,
    sortValue: (d) => (d.startsAt ? new Date(d.startsAt).getTime() : 0),
    render: (d) => <span className="tabular-nums">{datesLabel(d)}</span>,
  },
  {
    id: 'status',
    title: discountsContent.columns.status,
    render: (d) => <DiscountLifecyclePill lifecycle={d.lifecycle} />,
  },
]

type TabsProps = {
  value: DiscountLifecycle | null
  allCount: number
  onChange: (s: DiscountLifecycle | null) => void
}

function LifecycleTabs({ value, allCount, onChange }: TabsProps) {
  return (
    <div role="tablist" className="flex items-center rounded-lg bg-primary-soft p-1">
      <button
        type="button"
        role="tab"
        aria-selected={value === null}
        onClick={() => onChange(null)}
        className={cn(TAB, value === null && TAB_ACTIVE)}
      >
        {discountsContent.tabs.all}
        <span className="text-xs font-semibold text-primary tabular-nums">({allCount})</span>
      </button>
      {DISCOUNT_LIFECYCLES.map((s) => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={value === s}
          onClick={() => onChange(s)}
          className={cn(TAB, value === s && TAB_ACTIVE)}
        >
          {discountsContent.tabs[s]}
        </button>
      ))}
    </div>
  )
}

function DiscountsContent({ initial }: { initial: DiscountsInitial }) {
  // Hooks
  const [{ page, query, status }, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(DISCOUNT_LIFECYCLES),
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
    fetchDiscounts({ page, query, status })
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
        <h1 className="text-page-title">{discountsContent.heading}</h1>
        <Button
          size="lg"
          className="w-40"
          render={<Link href="/discounts/new" />}
          nativeButton={false}
        >
          <SquarePlus strokeWidth={1.6} />
          {discountsContent.create}
        </Button>
      </div>
      <DiscountTiles stats={initial.stats} />
      <div className="-mt-1">
        <ResourceTable
          resourceName={discountsContent.resource}
          columns={columns}
          items={items}
          getId={(d) => d.id}
          href={(d) => `/discounts/${d.id}`}
          loading={loading}
          query={query}
          onQueryChange={(query) => setQ({ query, page: 1 })}
          onClearAll={() => setQ({ query: '', status: null, page: 1 })}
          tabs={
            <LifecycleTabs
              value={status}
              allCount={initial.allCount}
              onChange={(s) => setQ({ status: s, page: 1 })}
            />
          }
          page={page}
          perPage={PER_PAGE}
          total={total}
          onPageChange={(page) => setQ({ page })}
          selectable={false}
          empty={discountsContent.empty}
        />
      </div>
    </PageBody>
  )
}

export default function DiscountsPage({ initial }: { initial: DiscountsInitial }) {
  return (
    <Suspense>
      <DiscountsContent initial={initial} />
    </Suspense>
  )
}
