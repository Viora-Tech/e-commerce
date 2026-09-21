'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { ChevronDown } from 'lucide-react'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PageBody } from '@/components/layout/page-body'
import { OrderPaymentBadge, OrderStatusPill } from '@/components/orders/order-badges'
import { type ResourceColumnSpec, ResourceTable } from '@/components/table/resource-table'
import { ORDER_STATUSES, type OrderStatus, ordersContent } from '@/data/orders'
import { api } from '@/lib/api-client'
import { LIST_PER_PAGE, type ListQuery, sameListQuery } from '@/lib/list-query'
import { formatPaise } from '@/lib/money'

type ListResult = Awaited<ReturnType<typeof api.orders.list>>
type Item = ListResult['items'][number]

/** First page rendered on the server so the table never paints empty. */
export type OrdersInitial = { query: ListQuery<OrderStatus>; result: ListResult }

const PER_PAGE = LIST_PER_PAGE
const ALL = 'all'
const TAB =
  'h-8 rounded-full px-4 text-sm data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none'

const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

type Query = ListQuery<OrderStatus>

function fetchOrders(q: Query) {
  return api.orders.list({
    page: q.page,
    perPage: PER_PAGE,
    search: q.query || undefined,
    status: q.status ?? undefined,
  })
}

const columns: ResourceColumnSpec<Item>[] = [
  {
    id: 'number',
    title: ordersContent.columns.order,
    sortValue: (o) => o.number,
    hideable: false,
    render: (o) => <span className="font-bold text-ink-strong">#{o.number}</span>,
  },
  {
    id: 'date',
    title: ordersContent.columns.date,
    sortValue: (o) => new Date(o.placedAt).getTime(),
    render: (o) => (
      <span className="text-muted-foreground">{dateTime.format(new Date(o.placedAt))}</span>
    ),
  },
  {
    id: 'customer',
    title: ordersContent.columns.customer,
    sortValue: (o) => o.customerName ?? o.email ?? '',
    render: (o) => o.customerName ?? o.email ?? ordersContent.guest,
  },
  {
    id: 'total',
    title: ordersContent.columns.total,
    sortValue: (o) => o.totalPaise,
    align: 'end',
    render: (o) => (
      <span className="font-bold text-ink-strong tabular-nums">{formatPaise(o.totalPaise)}</span>
    ),
  },
  {
    id: 'payment',
    title: ordersContent.columns.payment,
    render: (o) => <OrderPaymentBadge status={o.status} paymentMethod={o.paymentMethod} />,
  },
  {
    id: 'status',
    title: ordersContent.columns.status,
    sortValue: (o) => o.status,
    render: (o) => <OrderStatusPill status={o.status} />,
  },
]

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
    <PageBody>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={q.status ?? ALL}
          onValueChange={(v) => setQ({ status: v === ALL ? null : (v as OrderStatus), page: 1 })}
        >
          <TabsList className="h-10 rounded-full bg-card p-1 shadow-card">
            <TabsTrigger value={ALL} className={TAB}>
              {ordersContent.tabs.all}
            </TabsTrigger>
            {ORDER_STATUSES.map((s) => (
              <TabsTrigger key={s} value={s} className={TAB}>
                {ordersContent.status[s]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
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
