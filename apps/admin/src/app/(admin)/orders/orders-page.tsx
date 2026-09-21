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
import { PageHeader } from '@/components/layout/page-header'
import { OrderPaymentBadge, OrderStatusBadge } from '@/components/orders/order-badges'
import { type ResourceColumnSpec, ResourceTable } from '@/components/table/resource-table'
import { ORDER_STATUSES, type OrderStatus, ordersContent } from '@/data/orders'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

type Item = Awaited<ReturnType<typeof api.orders.list>>['items'][number]

const PER_PAGE = 25
const ALL = 'all'

const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

type Query = { page: number; query: string; status: OrderStatus | null }

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
    render: (o) => <span className="font-medium">#{o.number}</span>,
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
    render: (o) => <span className="tabular-nums">{formatPaise(o.totalPaise)}</span>,
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
    render: (o) => <OrderStatusBadge status={o.status} />,
  },
]

function OrdersContent() {
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(ORDER_STATUSES),
    },
    { shallow: true },
  )
  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const { page, query, status } = q

  useEffect(() => {
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
  }, [page, query, status])

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
      <PageHeader
        title={ordersContent.title}
        actions={
          <Button variant="outline" disabled>
            {ordersContent.export}
          </Button>
        }
      />
      <Tabs
        value={q.status ?? ALL}
        onValueChange={(v) => setQ({ status: v === ALL ? null : (v as OrderStatus), page: 1 })}
      >
        <TabsList>
          <TabsTrigger value={ALL}>{ordersContent.tabs.all}</TabsTrigger>
          {ORDER_STATUSES.map((s) => (
            <TabsTrigger key={s} value={s}>
              {ordersContent.status[s]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
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

export function OrdersPage() {
  return (
    <Suspense>
      <OrdersContent />
    </Suspense>
  )
}
