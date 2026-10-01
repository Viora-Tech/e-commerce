'use client'

import { ChevronDown, ExternalLink, MoreVertical, SquarePlus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import CustomerAvatar from '@/components/customers/customer-avatar'
import KitListPage from '@/components/kit/kit-list-page'
import PillTabs from '@/components/layout/pill-tabs'
import { orderStage } from '@/components/orders/order-stage'
import StatusLabel from '@/components/status/status-label'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import RowIconCells from '@/components/table/row-icon-cells'
import {
  ORDER_LIST_FILTERS,
  ORDER_MARKS,
  type OrderListFilter,
  type OrderMark,
  ordersContent,
  PENDING_UPI,
} from '@/data/orders'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'
import { formatNumericDate } from '@/lib/format-date'
import { LIST_PER_PAGE, type ListQuery, sameListQuery } from '@/lib/list-query'
import { orderListFilter } from '@/lib/order-filter'
import { usePrimaryAction } from '@/lib/primary-action'

type ListResult = Awaited<ReturnType<typeof api.orders.list>>
type Item = ListResult['items'][number]

/** First page, tiles and the all-orders count rendered on the server so nothing paints empty. */
export type OrdersInitial = {
  query: ListQuery<OrderListFilter>
  result: ListResult
  allCount: number
  /** Manual UPI / bank transfer orders waiting to be marked paid; the Pending UPI tab's badge. */
  pendingUpiCount: number
}

const PER_PAGE = LIST_PER_PAGE

type Query = ListQuery<OrderListFilter>

function fetchOrders(q: Query) {
  return api.orders.list({
    page: q.page,
    perPage: PER_PAGE,
    search: q.query || undefined,
    ...orderListFilter(q.status),
  })
}

/* Avatar + order number, the customer's name muted beneath: one column instead of two. */
function OrderCell({ item }: { item: Item }) {
  // Hooks
  const copy = useCopy(ordersContent)

  // Render logic
  const who = item.customerName ?? item.email ?? copy.guest
  return (
    <span className="flex items-center gap-3 text-left">
      <CustomerAvatar name={item.customerName} email={item.email} />
      <span className="min-w-0">
        <span className="line-clamp-1 font-medium text-ink-strong tabular-nums">
          #{item.number}
        </span>
        <span className="line-clamp-1 text-caption text-muted-foreground">{who}</span>
      </span>
    </span>
  )
}

/* 32px thumb on a hairline, the first line title and a muted "+n more" under it. */
function ProductCell({ item }: { item: Item }) {
  // Hooks
  const copy = useCopy(ordersContent)

  // Render logic
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
          {item.firstLineTitle ?? copy.guest}
        </span>
        {extra > 0 ? (
          <span className="block text-caption font-normal text-muted-foreground">
            {copy.moreLines(extra)}
          </span>
        ) : null}
      </span>
    </span>
  )
}

function orderColumns(copy: typeof ordersContent, fmt: Formatters): ResourceColumnSpec<Item>[] {
  return [
    {
      id: 'number',
      title: copy.columns.order,
      sortValue: (o) => o.number,
      hideable: false,
      className: 'w-[15%] whitespace-normal',
      render: (o) => <OrderCell item={o} />,
    },
    {
      id: 'product',
      title: copy.columns.product,
      align: 'start',
      className: 'w-[30%] whitespace-normal',
      render: (o) => <ProductCell item={o} />,
    },
    {
      id: 'date',
      title: copy.columns.date,
      sortValue: (o) => new Date(o.placedAt).getTime(),
      render: (o) => <span className="tabular-nums">{formatNumericDate(o.placedAt)}</span>,
    },
    {
      id: 'total',
      title: copy.columns.total,
      sortValue: (o) => o.totalPaise,
      align: 'end',
      render: (o) => <span className="tabular-nums">{fmt.money(o.totalPaise)}</span>,
    },
    {
      id: 'payment',
      title: copy.columns.payment,
      sortValue: (o) => o.paymentStatus,
      render: (o) => <StatusLabel kind="orderPayment" value={o.paymentStatus} />,
    },
    {
      id: 'status',
      title: copy.columns.status,
      sortValue: (o) => `${o.status}:${o.fulfillmentStatus}`,
      render: (o) => {
        const stage = orderStage(o)
        return <StatusLabel kind={stage.kind} value={stage.value} />
      },
    },
  ]
}

type TabsProps = {
  value: OrderListFilter | null
  allCount: number
  pendingUpiCount: number
  onChange: (s: OrderListFilter | null) => void
}

function StatusTabs({ value, allCount, pendingUpiCount, onChange }: TabsProps) {
  // Hooks
  const copy = useCopy(ordersContent)

  return (
    <PillTabs<OrderListFilter | null>
      value={value}
      onChange={onChange}
      tabs={[
        { value: null, label: copy.tabs.all, count: allCount },
        ...ORDER_LIST_FILTERS.map((s) => ({
          value: s,
          label: copy.tabs[s],
          ...(s === PENDING_UPI ? { count: pendingUpiCount } : {}),
        })),
      ]}
    />
  )
}

/* Secondary menu first, the ink primary action last (PageHeader order). */
function HeaderActions() {
  // Hooks
  const copy = useCopy(ordersContent)

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="lg" className="pr-2" />}>
          {copy.moreActions}
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href="/orders/drafts" />}>
            {copy.menu.drafts}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/orders/abandoned-checkouts" />}>
            {copy.menu.abandoned}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/orders/returns" />}>
            {copy.menu.returns}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button size="lg" render={<Link href="/orders/drafts" />} nativeButton={false}>
              <SquarePlus strokeWidth={1.6} />
              {copy.addOrder}
            </Button>
          }
        />
        <TooltipContent>
          {copy.addOrder} <Kbd>N</Kbd>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

function OrdersContent({ initial }: { initial: OrdersInitial }) {
  // Hooks
  const copy = useCopy(ordersContent)
  const fmt = useFormat()
  usePrimaryAction('/orders/drafts')
  const [{ page, query, status }, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(ORDER_LIST_FILTERS),
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
  const handleBulkSetStatus = async (ids: string[], mark: OrderMark, clear: () => void) => {
    try {
      await Promise.all(ids.map((id) => api.orders.setStatus({ id, status: mark })))
      toast.success(copy.bulk.updated(ids.length, copy.marks[mark]))
      clear()
      const r = await fetchOrders({ page, query, status })
      setItems(r.items)
      setTotal(r.total)
    } catch {
      toast.error(copy.bulk.failed)
    }
  }

  // Render logic
  const columns = orderColumns(copy, fmt)

  return (
    <KitListPage title={copy.heading} actions={<HeaderActions />}>
      <ResourceTable
        resourceName={copy.resource}
        columns={columns}
        items={items}
        getId={(o) => o.id}
        href={(o) => `/orders/${o.id}`}
        rowIconCells={{
          count: 2,
          render: (o) => (
            <RowIconCells
              links={[
                {
                  label: copy.row.openNewTab,
                  icon: ExternalLink,
                  href: `/orders/${o.id}`,
                  newTab: true,
                },
              ]}
              menu={[
                { label: copy.row.open, href: `/orders/${o.id}` },
                ...(o.email
                  ? [
                      {
                        label: copy.row.sameCustomer,
                        href: `/orders?query=${encodeURIComponent(o.email)}`,
                      },
                    ]
                  : []),
              ]}
            />
          ),
        }}
        loading={loading}
        query={query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', status: null, page: 1 })}
        tabs={
          <StatusTabs
            value={status}
            allCount={initial.allCount}
            pendingUpiCount={initial.pendingUpiCount}
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
              {copy.bulk.markAs}
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {ORDER_MARKS.map((s) => (
                <DropdownMenuItem key={s} onClick={() => handleBulkSetStatus(ids, s, clear)}>
                  {copy.marks[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        empty={copy.empty}
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
