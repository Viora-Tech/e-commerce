'use client'

import { AppWindow, ExternalLink, SquarePlus, Users } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import CustomerAvatar from '@/components/customers/customer-avatar'
import ActionMenu from '@/components/layout/action-menu'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import StatusChip from '@/components/layout/status-chip'
import OrderChip from '@/components/orders/order-chip'
import { orderStage } from '@/components/orders/order-stage'
import OrdersBulkActions from '@/components/orders/orders-bulk-actions'
import OrdersTiles, { type OrderTilesData } from '@/components/orders/orders-tiles'
import ProductThumb from '@/components/products/product-thumb'
import InlineState from '@/components/states/inline-state'
import {
  appliedFromGroups,
  clearGroups,
  FILTER_PANEL_CLASS,
  FilterPanel,
} from '@/components/table/filter-panel'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import RowMenu from '@/components/table/row-menu'
import ViewSelect from '@/components/table/view-select'
import { filterPanelContent } from '@/data/filter-panel'
import {
  ORDER_LIST_FILTERS,
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
import {
  FILTER_PARAMS,
  hasOrderFilters,
  NO_FILTERS,
  type OrderFilters as OrderFiltersValue,
  orderFilterGroups,
  orderFilterInput,
} from '@/lib/order-list-filters'
import { usePrimaryAction } from '@/lib/primary-action'
import { routes } from '@/lib/routes'
import { parseRowsPerPage } from '@/lib/rows-per-page'

/** How many orders a bulk action updates at once. */
const BULK_BATCH = 10

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

function fetchOrders(q: Query, perPage: number, f: OrderFiltersValue) {
  return api.orders.list({
    page: q.page,
    perPage,
    search: q.query || undefined,
    ...orderListFilter(q.status),
    ...orderFilterInput(f),
  })
}

/* Figma "Table / Cell · Avatar": a 24px muted initials disc, the customer's name 14/20 medium
   and their email 12/16 muted beneath (owner: a Customer column of its own). */
function CustomerCell({ item }: { item: Item }) {
  // Hooks
  const copy = useCopy(ordersContent)

  // Render logic
  const who = item.customerName ?? item.email ?? copy.guest
  return (
    <span className="flex items-center gap-3 text-left">
      <CustomerAvatar
        name={item.customerName}
        email={item.email}
        className="size-6 bg-muted font-medium text-foreground"
      />
      <span className="min-w-0">
        <span className="line-clamp-1 text-body font-medium text-ink-strong">{who}</span>
        {item.customerName && item.email ? (
          <span className="line-clamp-1 text-xs text-muted-foreground">{item.email}</span>
        ) : null}
      </span>
    </span>
  )
}

/* Figma "Table / Cell · Thumb": a 32px radius-6 muted thumb on a border, the first line title
   13/19 and a muted 12/16 "+n more" under it. */
function ProductCell({ item }: { item: Item }) {
  // Hooks
  const copy = useCopy(ordersContent)

  // Render logic
  const extra = item.lineCount - 1
  return (
    <span className="flex items-center gap-3 text-left">
      {/* No picture, or one that fails to load, shows the image icon (Figma Thumb cell). */}
      <ProductThumb url={item.firstLineImage} className="rounded-[0.375rem]" />
      <span className="min-w-0">
        <span className="line-clamp-1 text-[0.8125rem] leading-[1.1875rem] text-foreground">
          {item.firstLineTitle ?? copy.guest}
        </span>
        {extra > 0 ? (
          <span className="block text-xs text-muted-foreground">{copy.moreLines(extra)}</span>
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
      className: 'w-[9%]',
      render: (o) => (
        <span className="text-body font-medium text-ink-strong tabular-nums">#{o.number}</span>
      ),
    },
    {
      id: 'customer',
      title: copy.columns.customer,
      sortValue: (o) => (o.customerName ?? o.email ?? '').toLowerCase(),
      className: 'w-[20%] whitespace-normal',
      render: (o) => <CustomerCell item={o} />,
    },
    {
      id: 'product',
      title: copy.columns.product,
      className: 'w-[24%] whitespace-normal',
      render: (o) => <ProductCell item={o} />,
    },
    {
      id: 'date',
      title: copy.columns.date,
      sortValue: (o) => new Date(o.placedAt).getTime(),
      sortLabels: { desc: copy.sortNewest, asc: copy.sortOldest },
      render: (o) => (
        <span className="text-[0.8125rem] text-muted-foreground tabular-nums">
          {fmt.when(o.placedAt)}
        </span>
      ),
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
      id: 'fulfilment',
      title: copy.columns.fulfilment,
      sortValue: (o) => o.fulfillmentStatus,
      align: 'center',
      render: (o) => <OrderChip kind="fulfilment" value={o.fulfillmentStatus} />,
    },
    {
      id: 'status',
      title: copy.columns.status,
      sortValue: (o) => `${o.status}:${o.fulfillmentStatus}`,
      align: 'center',
      render: (o) => {
        if (
          o.status === 'open' &&
          o.fulfillmentStatus === 'unfulfilled' &&
          o.paymentStatus === 'paid'
        )
          return <StatusChip tone="info">{copy.toShip}</StatusChip>
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
      <ActionMenu
        label={copy.moreActions}
        trigger="button"
        variant="key-neutral"
        items={[
          { label: copy.menu.drafts, href: routes.orders.drafts() },
          { label: copy.menu.abandoned, href: routes.orders.abandonedCheckouts() },
          { label: copy.menu.returns, href: routes.orders.returns() },
        ]}
      />
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
  const panelCopy = useCopy(filterPanelContent)
  const fmt = useFormat()
  usePrimaryAction(routes.orders.drafts())
  const [{ page, query, status, perPage: rawPerPage, payment, fulfilment, date, method }, setQ] =
    useQueryStates(
      {
        query: parseAsString.withDefault(''),
        page: parseAsInteger.withDefault(1),
        status: parseAsStringLiteral(ORDER_LIST_FILTERS),
        perPage: parseAsInteger.withDefault(initial.perPage),
        ...FILTER_PARAMS,
      },
      { shallow: true },
    )

  const [items, setItems] = useState<Item[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const hydrated = useRef(false)

  useEffect(() => {
    const perPage = parseRowsPerPage(rawPerPage)
    // The server's first page is used once; after any change (including back to the first
    // tab) the list is fetched again, so it never keeps another tab's rows.
    const firstRun = !hydrated.current
    hydrated.current = true
    const f: OrderFiltersValue = { payment, fulfilment, date, method }
    if (
      firstRun &&
      perPage === initial.perPage &&
      !hasOrderFilters(f) &&
      sameListQuery({ page, query, status }, initial.query)
    )
      return
    let cancelled = false
    setLoading(true)
    setFailed(false)
    fetchOrders({ page, query, status }, perPage, f)
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
  }, [
    page,
    query,
    status,
    rawPerPage,
    payment,
    fulfilment,
    date,
    method,
    initial.query,
    initial.perPage,
  ])

  // Event handlers
  const setFilters = (patch: Partial<OrderFiltersValue>) => setQ({ ...patch, page: 1 })
  const handleBulkSetStatus = async (ids: string[], mark: OrderMark, clear: () => void) => {
    try {
      /* "Select all" can hand over thousands of ids: ten requests at a time, never all at once. */
      for (let i = 0; i < ids.length; i += BULK_BATCH) {
        await Promise.all(
          ids.slice(i, i + BULK_BATCH).map((id) => api.orders.setStatus({ id, status: mark })),
        )
      }
      toast.success(copy.bulk.updated(ids.length, copy.marks[mark]))
      clear()
      const r = await fetchOrders({ page, query, status }, parseRowsPerPage(rawPerPage), {
        payment,
        fulfilment,
        date,
        method,
      })
      setItems(r.items)
      setTotal(r.total)
    } catch {
      toast.error(copy.bulk.failed)
    }
  }

  // Render logic
  const perPage = parseRowsPerPage(rawPerPage)
  const columns = orderColumns(copy, fmt)
  const filters: OrderFiltersValue = { payment, fulfilment, date, method }
  const filtered = hasOrderFilters(filters)
  const groups = orderFilterGroups(filters, copy.filters, setFilters)
  const searching = query.length > 0 || status !== null || filtered
  const tabCounts: Partial<Record<OrderListFilter, number>> = {
    unpaid: initial.counts.unpaid,
    unfulfilled: initial.counts.unfulfilled,
    [PENDING_UPI]: initial.counts.pendingUpi,
  }

  return (
    <ProoflyListPage
      title={copy.title}
      summary={copy.summary(
        initial.counts.all,
        initial.tiles.readyToShip,
        initial.counts.pendingUpi,
      )}
      actions={<HeaderActions />}
      stats={
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
              { label: copy.row.open, href: routes.orders.detail(o.id), icon: AppWindow },
              {
                label: copy.row.openNewTab,
                href: routes.orders.detail(o.id),
                icon: ExternalLink,
                newTab: true,
              },
              ...(o.email
                ? [
                    {
                      label: copy.row.sameCustomer,
                      href: `${routes.orders.list()}?query=${encodeURIComponent(o.email)}`,
                      icon: Users,
                    },
                  ]
                : []),
            ]}
          />
        )}
        loading={loading}
        defaultSort={{ id: 'date', desc: true }}
        defaultHidden={['fulfilment']}
        query={query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', status: null, ...NO_FILTERS, page: 1 })}
        filters={(close) => (
          <FilterPanel
            groups={groups}
            onClear={() => clearGroups(groups)}
            footer={{ label: copy.filters.show(total), onDone: close }}
          />
        )}
        filtersClassName={FILTER_PANEL_CLASS}
        applied={appliedFromGroups(groups, panelCopy)}
        views={
          <ViewSelect<OrderListFilter | null>
            label={copy.viewLabel}
            value={status}
            onChange={(s) => setQ({ status: s, ...NO_FILTERS, page: 1 })}
            formatCount={fmt.number}
            custom={filtered ? { label: copy.customView, count: total } : undefined}
            options={[
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
        loadAllIds={() =>
          api.orders.ids({
            search: query || undefined,
            ...orderListFilter(status),
            ...orderFilterInput(filters),
          })
        }
        bulkActions={(ids, clear) => (
          <OrdersBulkActions ids={ids} onMark={(i, m) => handleBulkSetStatus(i, m, clear)} />
        )}
        empty={searching ? copy.noResults : copy.empty}
      />
    </ProoflyListPage>
  )
}

export default function OrdersPage({ initial }: { initial: OrdersInitial }) {
  return (
    <Suspense>
      <OrdersContent initial={initial} />
    </Suspense>
  )
}
