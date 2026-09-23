'use client'

import { ChevronDown, MoreVertical, SquarePlus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import KitListPage from '@/components/kit/kit-list-page'
import PillTabs from '@/components/layout/pill-tabs'
import { paymentStatusOf } from '@/components/orders/order-payment-state'
import OrderTiles, { type OrderStats } from '@/components/orders/order-tiles'
import StatusLabel from '@/components/status/status-label'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
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

/* 32px thumb on a hairline, the first line title and a muted "+n more" under it. */
function ProductCell({ item }: { item: Item }) {
  const extra = item.lineCount - 1
  return (
    <span className="flex items-center gap-3 text-left">
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card">
        {item.firstLineImage ? (
          // biome-ignore lint/performance/noImgElement: remote store media, sized by the frame.
          <img src={item.firstLineImage} alt="" className="size-7 object-contain" />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="line-clamp-1 text-body text-foreground">
          {item.firstLineTitle ?? ordersContent.guest}
        </span>
        {extra > 0 ? (
          <span className="block text-caption font-normal text-muted-foreground">
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
    className: 'w-24',
    render: (o) => <span className="font-medium text-ink-strong tabular-nums">#{o.number}</span>,
  },
  {
    id: 'product',
    title: ordersContent.columns.product,
    align: 'start',
    className: 'w-[30%] whitespace-normal',
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
    align: 'end',
    render: (o) => <span className="tabular-nums">{formatPaise(o.totalPaise)}</span>,
  },
  {
    id: 'payment',
    title: ordersContent.columns.payment,
    render: (o) => (
      <StatusLabel
        kind="payment"
        value={paymentStatusOf({ status: o.status, paymentMethod: o.paymentMethod })}
      />
    ),
  },
  {
    id: 'status',
    title: ordersContent.columns.status,
    sortValue: (o) => o.status,
    render: (o) => <StatusLabel kind="order" value={o.status} variant="pill" />,
  },
]

type TabsProps = {
  value: OrderStatus | null
  allCount: number
  onChange: (s: OrderStatus | null) => void
}

function StatusTabs({ value, allCount, onChange }: TabsProps) {
  return (
    <PillTabs
      value={value}
      onChange={onChange}
      tabs={[
        { value: null, label: ordersContent.tabs.all, count: allCount },
        ...ORDER_STATUSES.map((s) => ({ value: s, label: ordersContent.status[s] })),
      ]}
    />
  )
}

/* Secondary menu first, the ink primary action last (PageHeader order). */
function HeaderActions() {
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="lg" className="pr-2" />}>
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
      <Button size="lg" render={<Link href="/orders/drafts" />} nativeButton={false}>
        <SquarePlus strokeWidth={1.6} />
        {ordersContent.addOrder}
      </Button>
    </div>
  )
}

function OrdersContent({ initial }: { initial: OrdersInitial }) {
  // Hooks
  const [{ page, query, status }, setQ] = useQueryStates(
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

  // Event handlers
  const handleBulkSetStatus = async (ids: string[], status: OrderStatus, clear: () => void) => {
    try {
      await Promise.all(ids.map((id) => api.orders.setStatus({ id, status })))
      toast.success(ordersContent.bulk.updated(ids.length, ordersContent.status[status]))
      clear()
      const r = await fetchOrders({ page, query, status })
      setItems(r.items)
      setTotal(r.total)
    } catch {
      toast.error(ordersContent.bulk.failed)
    }
  }

  return (
    <KitListPage
      title={ordersContent.heading}
      actions={<HeaderActions />}
      strip={<OrderTiles stats={initial.stats} />}
    >
      <ResourceTable
        resourceName={ordersContent.resource}
        columns={columns}
        items={items}
        getId={(o) => o.id}
        href={(o) => `/orders/${o.id}`}
        loading={loading}
        query={query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', status: null, page: 1 })}
        tabs={
          <StatusTabs
            value={status}
            allCount={initial.allCount}
            onChange={(s) => setQ({ status: s, page: 1 })}
          />
        }
        page={page}
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
                <DropdownMenuItem key={s} onClick={() => handleBulkSetStatus(ids, s, clear)}>
                  {ordersContent.status[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        empty={ordersContent.empty}
      />
    </KitListPage>
  )
}

export default function OrdersPage({ initial }: { initial: OrdersInitial }) {
  return (
    <Suspense>
      <OrdersContent initial={initial} />
    </Suspense>
  )
}
