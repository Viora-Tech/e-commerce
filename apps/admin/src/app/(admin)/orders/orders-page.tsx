'use client'

import { AppWindow, ExternalLink, Users } from '@commerce/ui/icons'
import { useRouter } from 'next/navigation'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { OrderActionGroup } from '@/apps/order-actions'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import DeleteTestOrdersDialog from '@/components/orders/delete-test-orders-dialog'
import OrderRowMenu from '@/components/orders/order-row-menu'
import OrdersBulkActions from '@/components/orders/orders-bulk-actions'
import OrdersBulkDialogs, { type OrdersBulkRequest } from '@/components/orders/orders-bulk-dialogs'
import OrdersHeaderActions from '@/components/orders/orders-header-actions'
import OrdersTiles, { type OrderTilesData } from '@/components/orders/orders-tiles'
import { useOrderAppActions } from '@/components/orders/use-order-app-actions'
import InlineState from '@/components/states/inline-state'
import {
  appliedFromGroups,
  clearGroups,
  FILTER_PANEL_CLASS,
  FilterPanel,
} from '@/components/table/filter-panel'
import ResourceTable from '@/components/table/resource-table'
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
import { type ListQuery, sameListQuery } from '@/lib/list-query'
import { orderColumns } from '@/lib/order-columns'
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
  /** Installed apps' order actions for the row menus and bulk bar (`api.apps.orderActions`). */
  appActions: OrderActionGroup[]
  /** The Automations app is installed: "Run automation" on the bulk bar. */
  automations: boolean
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

function OrdersContent({ initial }: { initial: OrdersInitial }) {
  // Hooks
  const copy = useCopy(ordersContent)
  const panelCopy = useCopy(filterPanelContent)
  const fmt = useFormat()
  const router = useRouter()
  usePrimaryAction(routes.orders.drafts())
  const [
    { page, query, status, perPage: rawPerPage, payment, fulfilment, date, method, courier },
    setQ,
  ] = useQueryStates(
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
  const [couriers, setCouriers] = useState<string[]>([])
  const [testOrders, setTestOrders] = useState(initial.result.testOrders)
  const [askDeleteTests, setAskDeleteTests] = useState(false)
  const [bulkRequest, setBulkRequest] = useState<OrdersBulkRequest | null>(null)

  const hydrated = useRef(false)
  const apps = useOrderAppActions(initial.appActions, () => {
    reload().catch(() => setFailed(true))
  })

  // The Courier filter lists only couriers the store's orders actually went with.
  useEffect(() => {
    api.orders.couriers().then(setCouriers, () => undefined)
  }, [])

  useEffect(() => {
    const perPage = parseRowsPerPage(rawPerPage)
    // The server's first page is used once; after any change (including back to the first
    // tab) the list is fetched again, so it never keeps another tab's rows.
    const firstRun = !hydrated.current
    hydrated.current = true
    const f: OrderFiltersValue = { payment, fulfilment, date, method, courier }
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
        setTestOrders(r.testOrders)
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
    courier,
    initial.query,
    initial.perPage,
  ])

  // Helpers
  const reload = async () => {
    const r = await fetchOrders({ page, query, status }, parseRowsPerPage(rawPerPage), {
      payment,
      fulfilment,
      date,
      method,
      courier,
    })
    setItems(r.items)
    setTotal(r.total)
    setTestOrders(r.testOrders)
  }

  // Event handlers
  const setFilters = (patch: Partial<OrderFiltersValue>) => setQ({ ...patch, page: 1 })
  const handleTestsDeleted = () => {
    // The tiles and tab counts come from the server render; the rows are fetched again here.
    router.refresh()
    reload().catch(() => setFailed(true))
  }
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
      await reload()
    } catch {
      toast.error(copy.bulk.failed)
    }
  }

  // Render logic
  /** Tags already on the loaded orders, offered while adding tags from a row. */
  const tagSuggestions = [...new Set(items.flatMap((o) => o.tags ?? []))]
  const perPage = parseRowsPerPage(rawPerPage)
  const columns = orderColumns(copy, fmt)
  const filters: OrderFiltersValue = { payment, fulfilment, date, method, courier }
  const filtered = hasOrderFilters(filters)
  const groups = orderFilterGroups(filters, copy.filters, setFilters, couriers)
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
      actions={
        <OrdersHeaderActions
          testOrders={testOrders}
          onDeleteTests={() => setAskDeleteTests(true)}
        />
      }
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
          <OrderRowMenu
            order={o}
            appItems={apps.items('row', o, [o.id])}
            tagSuggestions={tagSuggestions}
            onChanged={() => {
              router.refresh()
              reload().catch(() => setFailed(true))
            }}
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
        defaultHidden={['fulfilment', 'channel', 'tags']}
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
          <OrdersBulkActions
            ids={ids}
            onMark={(i, m) => handleBulkSetStatus(i, m, clear)}
            onRequest={(kind, i) => setBulkRequest({ kind, ids: i, clear })}
            appActions={initial.appActions}
            automations={initial.automations}
            onAppActionDone={() => {
              clear()
              reload().catch(() => setFailed(true))
            }}
          />
        )}
        empty={searching ? copy.noResults : copy.empty}
      />
      <OrdersBulkDialogs
        request={bulkRequest}
        items={items}
        tagSuggestions={tagSuggestions}
        onClose={() => setBulkRequest(null)}
        onDone={() => {
          setBulkRequest(null)
          reload().catch(() => setFailed(true))
        }}
      />
      <DeleteTestOrdersDialog
        open={askDeleteTests}
        onOpenChange={setAskDeleteTests}
        count={testOrders}
        onDeleted={handleTestsDeleted}
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
