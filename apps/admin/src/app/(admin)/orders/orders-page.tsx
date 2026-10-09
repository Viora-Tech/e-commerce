'use client'

import { ChevronDown, MoreVertical, SquarePlus } from '@commerce/ui/icons'
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
import PillTabs from '@/components/layout/pill-tabs'
import OrderChip from '@/components/orders/order-chip'
import { orderStage } from '@/components/orders/order-stage'
import OrdersListFrame from '@/components/orders/orders-list-frame'
import OrdersTiles, { type OrderTilesData } from '@/components/orders/orders-tiles'
import RowMenu from '@/components/orders/row-menu'
import InlineState from '@/components/states/inline-state'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
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
import { type ListQuery, sameListQuery } from '@/lib/list-query'
import { orderListFilter } from '@/lib/order-filter'
import { usePrimaryAction } from '@/lib/primary-action'
import { routes } from '@/lib/routes'
import { parseRowsPerPage } from '@/lib/rows-per-page'

type ListResult = Awaited<ReturnType<typeof api.orders.list>>
type Item = ListResult['items'][number]

/** First page, stat cards and tab counts rendered on the server so nothing paints empty. */
export type OrdersInitial = {
  query: ListQuery<OrderListFilter>
  perPage: number
  result: ListResult
  tiles: OrderTilesData
  /** Tab badges: every order, unpaid, to pack and manual UPI waiting to be matched. */
  counts: { all: number; unpaid: number; unfulfilled: number; pendingUpi: number }
}

type Query = ListQuery<OrderListFilter>

function fetchOrders(q: Query, perPage: number) {
  return api.orders.list({
    page: q.page,
    perPage,
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
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-hairline bg-card">
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
      className: 'w-[17%] whitespace-normal',
      render: (o) => <OrderCell item={o} />,
    },
    {
      id: 'product',
      title: copy.columns.product,
      className: 'w-[30%] whitespace-normal',
      render: (o) => <ProductCell item={o} />,
    },
    {
      id: 'date',
      title: copy.columns.date,
      sortValue: (o) => new Date(o.placedAt).getTime(),
      render: (o) => <span className="tabular-nums">{fmt.when(o.placedAt)}</span>,
    },
    {
      id: 'total',
      title: copy.columns.total,
      sortValue: (o) => o.totalPaise,
      align: 'end',
      render: (o) => <span className="font-medium tabular-nums">{fmt.money(o.totalPaise)}</span>,
    },
    {
      id: 'payment',
      title: copy.columns.payment,
      sortValue: (o) => o.paymentStatus,
      align: 'center',
      render: (o) => <OrderChip kind="orderPayment" value={o.paymentStatus} />,
    },
    {
      id: 'status',
      title: copy.columns.status,
      sortValue: (o) => `${o.status}:${o.fulfillmentStatus}`,
      align: 'center',
      render: (o) => {
        const stage = orderStage(o)
        return <OrderChip kind={stage.kind} value={stage.value} />
      },
    },
  ]
}

/* More actions (the other order lists) and the one key button. */
function HeaderActions() {
  // Hooks
  const copy = useCopy(ordersContent)

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="key-neutral" className="pr-2" />}>
          <MoreVertical className="size-4" />
          {copy.moreActions}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={routes.orders.drafts()} />}>
            {copy.menu.drafts}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={routes.orders.abandonedCheckouts()} />}>
            {copy.menu.abandoned}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={routes.orders.returns()} />}>
            {copy.menu.returns}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button render={<Link href={routes.orders.drafts()} />} nativeButton={false}>
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
  usePrimaryAction(routes.orders.drafts())
  const [{ page, query, status, perPage: rawPerPage }, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(ORDER_LIST_FILTERS),
      perPage: parseAsInteger.withDefault(initial.perPage),
    },
    { shallow: true },
  )

  const [items, setItems] = useState<Item[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const perPage = parseRowsPerPage(rawPerPage)
    if (perPage === initial.perPage && sameListQuery({ page, query, status }, initial.query)) {
      return
    }
    let cancelled = false
    setLoading(true)
    setFailed(false)
    fetchOrders({ page, query, status }, perPage)
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, query, status, rawPerPage, initial.query, initial.perPage])

  // Event handlers
  const handleBulkSetStatus = async (ids: string[], mark: OrderMark, clear: () => void) => {
    try {
      await Promise.all(ids.map((id) => api.orders.setStatus({ id, status: mark })))
      toast.success(copy.bulk.updated(ids.length, copy.marks[mark]))
      clear()
      const r = await fetchOrders({ page, query, status }, parseRowsPerPage(rawPerPage))
      setItems(r.items)
      setTotal(r.total)
    } catch {
      toast.error(copy.bulk.failed)
    }
  }

  // Render logic
  const perPage = parseRowsPerPage(rawPerPage)
  const columns = orderColumns(copy, fmt)
  const searching = query.length > 0 || status !== null
  const tabCounts: Partial<Record<OrderListFilter, number>> = {
    unpaid: initial.counts.unpaid,
    unfulfilled: initial.counts.unfulfilled,
    [PENDING_UPI]: initial.counts.pendingUpi,
  }

  return (
    <OrdersListFrame
      title={copy.title}
      summary={copy.summary(
        initial.counts.all,
        initial.tiles.readyToShip,
        initial.counts.pendingUpi,
      )}
      actions={<HeaderActions />}
      tiles={
        <OrdersTiles
          tiles={initial.tiles}
          status={status}
          onSelect={(s) => setQ({ status: s, page: 1 })}
        />
      }
    >
      {failed ? (
        <InlineState kind="error" heading={copy.loadFailed} onRetry={() => setQ({ page })} />
      ) : null}
      <ResourceTable
        resourceName={copy.resource}
        columns={columns}
        items={items}
        getId={(o) => o.id}
        href={(o) => routes.orders.detail(o.id)}
        rowActions={(o) => (
          <RowMenu
            items={[
              { label: copy.row.open, href: routes.orders.detail(o.id) },
              ...(o.email
                ? [
                    {
                      label: copy.row.sameCustomer,
                      href: `${routes.orders.list()}?query=${encodeURIComponent(o.email)}`,
                    },
                  ]
                : []),
            ]}
          />
        )}
        loading={loading}
        query={query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', status: null, page: 1 })}
        tabs={
          <PillTabs<OrderListFilter | null>
            variant="segmented"
            value={status}
            onChange={(s) => setQ({ status: s, page: 1 })}
            tabs={[
              { value: null, label: copy.tabs.all, count: initial.counts.all },
              ...ORDER_LIST_FILTERS.map((s) => {
                const count = tabCounts[s]
                return {
                  value: s,
                  label: copy.tabs[s],
                  ...(count === undefined ? {} : { count }),
                }
              }),
            ]}
          />
        }
        page={page}
        perPage={perPage}
        total={total}
        onPageChange={(page) => setQ({ page })}
        onPerPageChange={(n) => setQ({ perPage: n, page: 1 })}
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
        empty={searching ? copy.noResults : copy.empty}
      />
    </OrdersListFrame>
  )
}

export default function OrdersPage({ initial }: { initial: OrdersInitial }) {
  return (
    <Suspense>
      <OrdersContent initial={initial} />
    </Suspense>
  )
}
