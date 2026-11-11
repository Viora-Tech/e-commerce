'use client'

import { AppWindow, ExternalLink, Users } from '@commerce/ui/icons'
import { useRouter } from 'next/navigation'
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
  useQueryStates,
} from 'nuqs'
import { Suspense, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { OrderActionGroup } from '@/apps/order-actions'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import BulkFulfilDialog from '@/components/orders/bulk-fulfil-dialog'
import DeleteTestOrdersDialog from '@/components/orders/delete-test-orders-dialog'
import OrderRowMenu from '@/components/orders/order-row-menu'
import { orderRowDone } from '@/components/orders/order-stage'
import OrdersBulkActions from '@/components/orders/orders-bulk-actions'
import OrdersBulkDialogs, { type OrdersBulkRequest } from '@/components/orders/orders-bulk-dialogs'
import OrdersHeaderActions from '@/components/orders/orders-header-actions'
import OrdersTiles, { type OrderTilesData } from '@/components/orders/orders-tiles'
import { useOrderAppActions } from '@/components/orders/use-order-app-actions'
import InlineState from '@/components/states/inline-state'
import ResourceTable, { type TableSort } from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { approvalsContent } from '@/data/approvals'
import {
  ORDER_LIST_FILTERS,
  type OrderListFilter,
  type OrderMark,
  ordersContent,
  PENDING_UPI,
} from '@/data/orders'
import { ordersBulkContent } from '@/data/orders-bulk'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api, isApprovalQueued } from '@/lib/api-client'
import { ADMIN_REFRESH_EVENT } from '@/lib/focus-refresh'
import { type ListQuery, sameListQuery } from '@/lib/list-query'
import { orderColumns } from '@/lib/order-columns'
import { orderListFilter } from '@/lib/order-filter'
import {
  FILTER_PARAMS,
  hasOrderFilters,
  NO_FILTERS,
  NO_ORDER_FACETS,
  type OrderFacets,
  type OrderFilters,
  orderFilterGroups,
  orderFilterInput,
} from '@/lib/order-list-filters'
import { undeliverableInBulk } from '@/lib/order-next-move'
import { usePrimaryAction } from '@/lib/primary-action'
import { routes } from '@/lib/routes'
import { parseRowsPerPage } from '@/lib/rows-per-page'
import { runBatched } from '@/lib/run-batched'

/** Most ids one `orders.archiveMany` call takes (the API's BULK_MAX). */
const ARCHIVE_CHUNK = 200

const DEFAULT_SORT: TableSort = { id: 'date', desc: true }

/** `?sort=total.asc` as the table's sort; anything else (or none) is the default. */
function parseSort(param: string | null): TableSort | null {
  const match = /^([a-z]+)\.(asc|desc)$/.exec(param ?? '')
  return match?.[1] ? { id: match[1], desc: match[2] === 'desc' } : null
}

/** The table's sort as `?sort=`; the default sort leaves the URL clean. */
function sortParam(sort: TableSort | null): string | null {
  if (!sort || (sort.id === DEFAULT_SORT.id && sort.desc === DEFAULT_SORT.desc)) return null
  return `${sort.id}.${sort.desc ? 'desc' : 'asc'}`
}

/** The API refused this one order for a reason that is a skip, not a failure. */
function isBadRequest(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === 'BAD_REQUEST'
}

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

/** The page's URL state: tab, search, page and every panel filter. */
type Query = ListQuery<OrderListFilter> & OrderFilters

function fetchOrders(q: Query, perPage: number) {
  return api.orders.list({
    page: q.page,
    perPage,
    search: q.query || undefined,
    ...orderListFilter(q.status),
    ...orderFilterInput(q),
  })
}

function OrdersContent({ initial }: { initial: OrdersInitial }) {
  // Hooks
  const copy = useCopy(ordersContent)
  const approvals = useCopy(approvalsContent)
  const bulkCopy = useCopy(ordersBulkContent)
  const fmt = useFormat()
  const router = useRouter()
  usePrimaryAction(routes.orders.drafts())
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(ORDER_LIST_FILTERS),
      perPage: parseAsInteger.withDefault(initial.perPage),
      ...FILTER_PARAMS,
    },
    { shallow: true },
  )
  // Its own param: sorting orders the loaded page and never fetches the list again.
  const [sort, setSort] = useQueryState('sort', parseAsString.withOptions({ shallow: true }))

  const [items, setItems] = useState<Item[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [facets, setFacets] = useState<OrderFacets>(NO_ORDER_FACETS)
  const [testOrders, setTestOrders] = useState(initial.result.testOrders)
  const [askDeleteTests, setAskDeleteTests] = useState(false)
  const [bulkRequest, setBulkRequest] = useState<OrdersBulkRequest | null>(null)
  const [bulkFulfil, setBulkFulfil] = useState<{ ids: string[]; clear: () => void } | null>(null)

  const hydrated = useRef(false)
  const apps = useOrderAppActions(initial.appActions, () => {
    reload().catch(() => setFailed(true))
  })

  // The panel lists only tags, codes, couriers and collections the store actually uses.
  useEffect(() => {
    api.orders.facets().then(setFacets, () => undefined)
  }, [])

  useEffect(() => {
    const perPage = parseRowsPerPage(q.perPage)
    // The server's first page is used once; after any change (including back to the first
    // tab) the list is fetched again, so it never keeps another tab's rows.
    const firstRun = !hydrated.current
    hydrated.current = true
    if (
      firstRun &&
      perPage === initial.perPage &&
      !hasOrderFilters(q) &&
      sameListQuery({ page: q.page, query: q.query, status: q.status }, initial.query)
    )
      return
    let cancelled = false
    setLoading(true)
    setFailed(false)
    fetchOrders(q, perPage)
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
  }, [q, initial.query, initial.perPage])

  // Back on the tab (RefreshOnFocus): the rows live here, so they are read again with the page.
  useEffect(() => {
    const onRefresh = () => {
      fetchOrders(q, parseRowsPerPage(q.perPage)).then(
        (r) => {
          setItems(r.items)
          setTotal(r.total)
          setTestOrders(r.testOrders)
        },
        () => undefined,
      )
    }
    window.addEventListener(ADMIN_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(ADMIN_REFRESH_EVENT, onRefresh)
  }, [q])

  // Helpers
  const loadViewIds = () =>
    api.orders.ids({
      search: q.query || undefined,
      ...orderListFilter(q.status),
      ...orderFilterInput(q),
    })
  const reload = async () => {
    const r = await fetchOrders(q, parseRowsPerPage(q.perPage))
    setItems(r.items)
    setTotal(r.total)
    setTestOrders(r.testOrders)
  }

  // Event handlers
  const setFilters = (patch: Partial<OrderFilters>) => setQ({ ...patch, page: 1 })
  const handleTestsDeleted = () => {
    // The tiles and tab counts come from the server render; the rows are fetched again here.
    router.refresh()
    reload().catch(() => setFailed(true))
  }
  const handleBulkSetStatus = async (ids: string[], mark: OrderMark, clear: () => void) => {
    // Mark as fulfilled asks for one courier and a tracking number per order (owner, 11 Nov).
    if (mark === 'fulfilled') return void setBulkFulfil({ ids, clear })
    /* Cancelled and imported orders on screen cannot take a mark: skipped without a call.
       Mark as delivered also skips what never went out (the API refuses it too). */
    const delivering = mark === 'delivered'
    const loaded = new Map(items.map((o) => [o.id, o]))
    const due = ids.filter((id) => {
      const o = loaded.get(id)
      if (o && delivering) return !o.importedFrom && !undeliverableInBulk(o)
      return !o || mark === 'cancelled' || (o.status !== 'cancelled' && !o.importedFrom)
    })
    let skipped = ids.length - due.length
    let updated = 0
    /* A role whose cancel needs approval: each order waits in Settings → Approvals instead. */
    let queued = 0
    /* "Select all" can hand over thousands of ids: ten requests at a time, never all at once. */
    const { failed } = await runBatched(due, async (id) => {
      try {
        await api.orders.setStatus({
          id,
          status: mark,
          ...(delivering ? { onlyShipped: true } : {}),
        })
        updated += 1
      } catch (err) {
        if (isApprovalQueued(err)) {
          queued += 1
          return
        }
        // The API refuses a locked (cancelled, imported) order with BAD_REQUEST: a skip.
        if (!isBadRequest(err)) throw err
        skipped += 1
      }
    })
    if (queued > 0) toast.info(approvals.sent)
    if (failed > 0 && updated === 0) toast.error(copy.bulk.failed)
    else if (failed > 0) toast.warning(copy.bulk.partlyFailed(updated, failed))
    else if (delivering && queued === 0) toast.info(bulkCopy.deliveredDone(updated, skipped))
    else if (updated === 0) {
      if (queued === 0) toast.info(copy.bulk.noneUpdated(skipped))
    } else if (skipped > 0)
      toast.success(copy.bulk.updatedSkipped(updated, copy.marks[mark], skipped))
    else toast.success(copy.bulk.updated(updated, copy.marks[mark]))
    if (updated > 0) {
      clear()
      await reload().catch(() => setFailed(true))
    }
  }

  const handleBulkArchive = async (ids: string[], archived: boolean, clear: () => void) => {
    try {
      let updated = 0
      let skipped = 0
      for (let i = 0; i < ids.length; i += ARCHIVE_CHUNK) {
        const r = await api.orders.archiveMany({ ids: ids.slice(i, i + ARCHIVE_CHUNK), archived })
        updated += r.updated
        skipped += r.skipped
      }
      const summary = archived
        ? bulkCopy.archived(updated, skipped)
        : bulkCopy.unarchived(updated, skipped)
      if (updated > 0) toast.success(summary)
      else toast.info(summary)
      clear()
      router.refresh()
      await reload().catch(() => setFailed(true))
    } catch {
      toast.error(bulkCopy.archiveFailed)
    }
  }

  // Render logic
  /** Tags already on the loaded orders, offered while adding tags from a row. */
  const tagSuggestions = [...new Set(items.flatMap((o) => o.tags ?? []))]
  const perPage = parseRowsPerPage(q.perPage)
  const columns = orderColumns(copy, fmt)
  const { page, query, status } = q
  const filtered = hasOrderFilters(q)
  const groups = orderFilterGroups(q, copy.filters, setFilters, facets)
  const searching = query.length > 0 || filtered
  const tabEmpty = status === 'archived' ? copy.emptyArchived : copy.emptyView
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
          loadViewIds={loadViewIds}
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
        rowMuted={orderRowDone}
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
        defaultSort={DEFAULT_SORT}
        // The sort rides in the URL beside the filters (#7); the columns are remembered (#9).
        sort={parseSort(sort)}
        onSortChange={(s) => setSort(sortParam(s))}
        columnsStorageKey="orders:columns"
        // Delivery and Tags show on the row by default (#1007); the rest stay in the columns menu.
        defaultHidden={['fulfilment', 'channel', 'items', 'phone', 'city']}
        query={query}
        onQueryChange={(query) => setQ({ query, page: 1 }, { history: 'replace' })}
        onClearAll={() => setQ({ query: '', status: null, ...NO_FILTERS, page: 1 })}
        filterGroups={groups}
        views={
          <ViewSelect<OrderListFilter | null>
            label={copy.viewLabel}
            value={status}
            onChange={(s) => setQ({ status: s, page: 1 })}
            formatCount={fmt.number}
            // A search or filter counts what it found, not the whole store: "All orders 1,357"
            // stayed beside "No orders match" (audit #50).
            custom={
              filtered || query.length > 0
                ? { label: status ? copy.tabs[status] : copy.customView, count: total }
                : undefined
            }
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
        loadAllIds={loadViewIds}
        bulkActions={(ids, clear) => (
          <OrdersBulkActions
            ids={ids}
            onMark={(i, m) => handleBulkSetStatus(i, m, clear)}
            onArchive={(i, archived) => handleBulkArchive(i, archived, clear)}
            onRequest={(kind, i) => setBulkRequest({ kind, ids: i, clear })}
            appActions={initial.appActions}
            automations={initial.automations}
            onAppActionDone={() => {
              clear()
              reload().catch(() => setFailed(true))
            }}
          />
        )}
        empty={searching ? copy.noResults : status !== null ? tabEmpty : copy.empty}
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
      <BulkFulfilDialog
        ids={bulkFulfil?.ids ?? null}
        items={items}
        onClose={() => setBulkFulfil(null)}
        onDone={() => {
          bulkFulfil?.clear()
          setBulkFulfil(null)
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
