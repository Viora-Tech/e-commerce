'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { ChevronDown, MoreVertical, SquarePlus } from 'lucide-react'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PageBody } from '@/components/layout/page-body'
import { OrderPaymentCell, OrderStatusCell } from '@/components/orders/order-badges'
import { type OrderStats, OrderTiles } from '@/components/orders/order-tiles'
import { type ResourceColumnSpec, ResourceTable } from '@/components/table/resource-table'
import { ORDER_STATUSES, type OrderStatus, ordersContent } from '@/data/orders'
import { api } from '@/lib/api-client'
import { LIST_PER_PAGE, type ListQuery, sameListQuery } from '@/lib/list-query'
import { formatPaise } from '@/lib/money'

type ListResult = Awaited<ReturnType<typeof api.orders.list>>
type Item = ListResult['items'][number]

/** First page, tiles and the all-orders count rendered on the server so nothing paints empty. */
export type OrdersInitial = {
  query: ListQuery<OrderStatus>
  result: ListResult
  stats: OrderStats
  allCount: number
}

const PER_PAGE = LIST_PER_PAGE

/* Frame 5:2561: soft-green track with 4px inset; the active tab is a white 6px pill. */
const TAB =
  'flex h-8 items-center gap-1 rounded-[6px] px-3 text-[15px] font-medium leading-5 text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const TAB_ACTIVE = 'bg-card text-foreground'

/* Frame 5:2617 writes dates as 01-01-2025. */
const date = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
const formatDate = (d: Date) => date.format(d).replaceAll('/', '-')

type Query = ListQuery<OrderStatus>

function fetchOrders(q: Query) {
  return api.orders.list({
    page: q.page,
    perPage: PER_PAGE,
    search: q.query || undefined,
    status: q.status ?? undefined,
  })
}

/* Frame 5:2612: 40px bordered thumb with the picture inset, title beside it. */
function ProductCell({ item }: { item: Item }) {
  const extra = item.lineCount - 1
  return (
    <span className="flex items-center gap-3 text-left">
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-secondary bg-card">
        {item.firstLineImage ? (
          // biome-ignore lint/performance/noImgElement: remote store media, sized by the frame.
          <img src={item.firstLineImage} alt="" className="size-[30px] object-contain" />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="line-clamp-2 text-[15px] leading-[18px]">
          {item.firstLineTitle ?? ordersContent.guest}
        </span>
        {extra > 0 ? (
          <span className="block text-caption text-muted-foreground">
            {ordersContent.moreLines(extra)}
          </span>
        ) : null}
      </span>
    </span>
  )
}

const columns: ResourceColumnSpec<Item>[] = [
  {
    id: 'number',
    title: ordersContent.columns.order,
    sortValue: (o) => o.number,
    hideable: false,
    className: 'w-[129px]',
    render: (o) => <span className="tabular-nums">#{o.number}</span>,
  },
  {
    id: 'product',
    title: ordersContent.columns.product,
    align: 'start',
    className: 'w-[260px] px-3 whitespace-normal',
    render: (o) => <ProductCell item={o} />,
  },
  {
    id: 'customer',
    title: ordersContent.columns.customer,
    sortValue: (o) => o.customerName ?? o.email ?? '',
    render: (o) => o.customerName ?? o.email ?? ordersContent.guest,
  },
  {
    id: 'date',
    title: ordersContent.columns.date,
    sortValue: (o) => new Date(o.placedAt).getTime(),
    render: (o) => <span className="tabular-nums">{formatDate(new Date(o.placedAt))}</span>,
  },
  {
    id: 'total',
    title: ordersContent.columns.total,
    sortValue: (o) => o.totalPaise,
    render: (o) => <span className="tabular-nums">{formatPaise(o.totalPaise)}</span>,
  },
  {
    id: 'payment',
    title: ordersContent.columns.payment,
    render: (o) => <OrderPaymentCell status={o.status} paymentMethod={o.paymentMethod} />,
  },
  {
    id: 'status',
    title: ordersContent.columns.status,
    sortValue: (o) => o.status,
    render: (o) => <OrderStatusCell status={o.status} />,
  },
]

type TabsProps = {
  value: OrderStatus | null
  allCount: number
  onChange: (s: OrderStatus | null) => void
}

function StatusTabs({ value, allCount, onChange }: TabsProps) {
  return (
    <div role="tablist" className="flex items-center rounded-lg bg-primary-soft p-1">
      <button
        type="button"
        role="tab"
        aria-selected={value === null}
        onClick={() => onChange(null)}
        className={cn(TAB, value === null && TAB_ACTIVE)}
      >
        {ordersContent.tabs.all}
        <span className="text-[14px] font-bold text-primary tabular-nums">({allCount})</span>
      </button>
      {ORDER_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={value === s}
          onClick={() => onChange(s)}
          className={cn(TAB, value === s && TAB_ACTIVE)}
        >
          {ordersContent.status[s]}
        </button>
      ))}
    </div>
  )
}

/* Frame 5:2502: 142 x 48 green primary with a 24px glyph, 142 x 48 outlined secondary. */
function HeaderActions() {
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/orders/drafts"
        className="flex h-12 w-[142px] items-center justify-center gap-1 rounded-lg bg-primary pr-4 pl-3 text-[15px] font-bold tracking-[-0.3px] text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <SquarePlus className="size-6" strokeWidth={1.6} />
        {ordersContent.addOrder}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              className="h-12 w-[142px] justify-center gap-1 rounded-lg border-secondary pr-2 pl-3 text-[15px] font-bold tracking-[-0.3px] text-ink-strong"
            />
          }
        >
          {ordersContent.moreActions}
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href="/orders/drafts" />}>
            {ordersContent.menu.drafts}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/orders/abandoned-checkouts" />}>
            {ordersContent.menu.abandoned}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function OrdersContent({ initial }: { initial: OrdersInitial }) {
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(ORDER_STATUSES),
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
    fetchOrders({ page, query, status })
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

  async function bulkSetStatus(ids: string[], status: OrderStatus, clear: () => void) {
    try {
      await Promise.all(ids.map((id) => api.orders.setStatus({ id, status })))
      toast.success(ordersContent.bulk.updated(ids.length, ordersContent.status[status]))
      clear()
      const r = await fetchOrders(q)
      setItems(r.items)
      setTotal(r.total)
    } catch {
      toast.error(ordersContent.bulk.failed)
    }
  }

  return (
    <PageBody className="gap-6">
      {/* 5:2375 + 5:2502: heading on the left, the two 48px actions on the right, 24px under the bar. */}
      <div className="flex h-12 items-center justify-between">
        <h1 className="text-page-title">{ordersContent.heading}</h1>
        <HeaderActions />
      </div>
      <OrderTiles stats={initial.stats} />
      <div className="-mt-1">
        <ResourceTable
          resourceName={ordersContent.resource}
          columns={columns}
          items={items}
          getId={(o) => o.id}
          href={(o) => `/orders/${o.id}`}
          loading={loading}
          query={q.query}
          onQueryChange={(query) => setQ({ query, page: 1 })}
          onClearAll={() => setQ({ query: '', status: null, page: 1 })}
          tabs={
            <StatusTabs
              value={q.status}
              allCount={initial.allCount}
              onChange={(s) => setQ({ status: s, page: 1 })}
            />
          }
          page={q.page}
          perPage={PER_PAGE}
          total={total}
          onPageChange={(page) => setQ({ page })}
          bulkActions={(ids, clear) => (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                {ordersContent.bulk.markAs}
                <ChevronDown />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {ORDER_STATUSES.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => bulkSetStatus(ids, s, clear)}>
                    {ordersContent.status[s]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          empty={ordersContent.empty}
        />
      </div>
    </PageBody>
  )
}

export function OrdersPage({ initial }: { initial: OrdersInitial }) {
  return (
    <Suspense>
      <OrdersContent initial={initial} />
    </Suspense>
  )
}
