/**
 * The admin Orders list (apps/admin/src/app/(admin)/orders/orders-page.tsx) on TanStack
 * Router + Query. Every component, column, filter and copy file is the admin's own; what
 * changed is where the data comes from: the Next server component read five things before
 * the first byte, here the route loader starts the same reads in parallel and the page
 * renders from TanStack Query's cache (instant on the way back, refetched on focus).
 *
 * TanStack Virtual is not used: the list is paginated at 100 rows at most
 * (siteConfig.ui.rowsPerPage), well under where windowing pays off.
 */
import { AppWindow, ExternalLink, Users } from '@commerce/ui/icons'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
  useQueryStates,
} from 'nuqs'
import { useState } from 'react'
import { toast } from 'sonner'
import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import DeleteTestOrdersDialog from '@/components/orders/delete-test-orders-dialog'
import OrderRowMenu from '@/components/orders/order-row-menu'
import { orderRowDone } from '@/components/orders/order-stage'
import OrdersBulkActions from '@/components/orders/orders-bulk-actions'
import OrdersBulkDialogs, { type OrdersBulkRequest } from '@/components/orders/orders-bulk-dialogs'
import OrdersHeaderActions from '@/components/orders/orders-header-actions'
import OrdersTiles from '@/components/orders/orders-tiles'
import { useOrderAppActions } from '@/components/orders/use-order-app-actions'
import InlineState from '@/components/states/inline-state'
import ResourceTable, { type TableSort } from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import {
  ORDER_LIST_FILTERS,
  type OrderListFilter,
  type OrderMark,
  ordersContent,
  PENDING_UPI,
} from '@/data/orders'
import { ordersBulkContent } from '@/data/orders-bulk'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { parseListQuery } from '@/lib/list-query'
import { orderColumns } from '@/lib/order-columns'
import { orderListFilter } from '@/lib/order-filter'
import {
  FILTER_PARAMS,
  hasOrderFilters,
  NO_FILTERS,
  NO_ORDER_FACETS,
  type OrderFilters,
  orderFilterGroups,
  orderFilterInput,
} from '@/lib/order-list-filters'
import { usePrimaryAction } from '@/lib/primary-action'
import { routes } from '@/lib/routes'
import { parseRowsPerPage } from '@/lib/rows-per-page'
import { runBatched } from '@/lib/run-batched'
import { orpc } from '~/query'

const ARCHIVE_CHUNK = 200
const DEFAULT_SORT: TableSort = { id: 'date', desc: true }

function parseSort(param: string | null): TableSort | null {
  const match = /^([a-z]+)\.(asc|desc)$/.exec(param ?? '')
  return match?.[1] ? { id: match[1], desc: match[2] === 'desc' } : null
}
function sortParam(sort: TableSort | null): string | null {
  if (!sort || (sort.id === DEFAULT_SORT.id && sort.desc === DEFAULT_SORT.desc)) return null
  return `${sort.id}.${sort.desc ? 'desc' : 'asc'}`
}
function isBadRequest(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === 'BAD_REQUEST'
}

type ListInput = Parameters<typeof api.orders.list>[0]
type ListShape = { page: number; query: string; status: OrderListFilter | null }

/** The same input the page builds, so the loader's prefetch and the page share one cache key. */
function listInput(q: ListShape, filters: OrderFilters | null, perPage: number): ListInput {
  return {
    page: q.page,
    perPage,
    search: q.query || undefined,
    ...orderListFilter(q.status),
    ...(filters && hasOrderFilters(filters) ? orderFilterInput(filters) : {}),
  }
}

const listQuery = (input: ListInput) =>
  orpc.orders.list.queryOptions({ input, placeholderData: keepPreviousData })

export const Route = createFileRoute('/_admin/orders')({
  // Starts every read the Next page.tsx made on the server, in parallel, before rendering.
  // The loader prefetches the unfiltered view; a panel filter in the URL is fetched by the page.
  loader: ({ context: { queryClient }, location }) => {
    const params = Object.fromEntries(new URLSearchParams(location.searchStr))
    const query = parseListQuery(params, ORDER_LIST_FILTERS)
    const perPage = parseRowsPerPage(params.perPage)
    void queryClient.prefetchQuery(listQuery(listInput(query, null, perPage)))
    void queryClient.prefetchQuery(orpc.orders.tabCounts.queryOptions())
    void queryClient.prefetchQuery(orpc.orders.tiles.queryOptions())
    void queryClient.prefetchQuery(orpc.apps.orderActions.queryOptions())
    void queryClient.prefetchQuery(orpc.orders.facets.queryOptions())
  },
  component: OrdersContent,
  pendingComponent: ListPageSkeleton,
})

function OrdersContent() {
  // Hooks
  const copy = useCopy(ordersContent)
  const bulkCopy = useCopy(ordersBulkContent)
  const fmt = useFormat()
  const queryClient = useQueryClient()
  usePrimaryAction(routes.orders.drafts())
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(ORDER_LIST_FILTERS),
      perPage: parseAsInteger.withDefault(parseRowsPerPage(undefined)),
      ...FILTER_PARAMS,
    },
    { shallow: true },
  )
  const [sort, setSort] = useQueryState('sort', parseAsString.withOptions({ shallow: true }))
  // One query per read; the list key follows the URL, so back/forward is a cache hit.
  const list = useQuery(listQuery(listInput(q, q, parseRowsPerPage(q.perPage))))
  const counts = useQuery(orpc.orders.tabCounts.queryOptions())
  const tiles = useQuery(orpc.orders.tiles.queryOptions())
  const appActions = useQuery(orpc.apps.orderActions.queryOptions())
  const facets = useQuery(orpc.orders.facets.queryOptions())
  const shell = useQuery({ ...orpc.store.shell.queryOptions(), staleTime: 5 * 60_000 })

  const [askDeleteTests, setAskDeleteTests] = useState(false)
  const [bulkRequest, setBulkRequest] = useState<OrdersBulkRequest | null>(null)
  const apps = useOrderAppActions(appActions.data ?? [], () => {
    void queryClient.invalidateQueries({ queryKey: orpc.orders.key() })
  })

  // Helpers
  // Next's `router.refresh()` plus `reload()` become one invalidation: list, tiles and counts.
  const reload = () => queryClient.invalidateQueries({ queryKey: orpc.orders.key() })
  const loadViewIds = () =>
    api.orders.ids({
      search: q.query || undefined,
      ...orderListFilter(q.status),
      ...orderFilterInput(q),
    })

  // Event handlers
  const setFilters = (patch: Partial<OrderFilters>) => setQ({ ...patch, page: 1 })
  const handleBulkSetStatus = async (ids: string[], mark: OrderMark, clear: () => void) => {
    const loaded = new Map((list.data?.items ?? []).map((o) => [o.id, o]))
    const due = ids.filter((id) => {
      const o = loaded.get(id)
      return !o || mark === 'cancelled' || (o.status !== 'cancelled' && !o.importedFrom)
    })
    let skipped = ids.length - due.length
    let updated = 0
    const { failed } = await runBatched(due, async (id) => {
      try {
        await api.orders.setStatus({ id, status: mark })
        updated += 1
      } catch (err) {
        if (!isBadRequest(err)) throw err
        skipped += 1
      }
    })
    if (failed > 0 && updated === 0) toast.error(copy.bulk.failed)
    else if (failed > 0) toast.warning(copy.bulk.partlyFailed(updated, failed))
    else if (updated === 0) toast.info(copy.bulk.noneUpdated(skipped))
    else if (skipped > 0)
      toast.success(copy.bulk.updatedSkipped(updated, copy.marks[mark], skipped))
    else toast.success(copy.bulk.updated(updated, copy.marks[mark]))
    if (updated > 0) {
      clear()
      await reload()
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
      await reload()
    } catch {
      toast.error(bulkCopy.archiveFailed)
    }
  }

  if (!list.data || !counts.data || !tiles.data) {
    return list.isError ? (
      <InlineState kind="error" heading={copy.loadFailed} onRetry={() => list.refetch()} />
    ) : (
      <ListPageSkeleton />
    )
  }

  // Render logic
  const items = list.data.items
  const total = list.data.total
  const testOrders = list.data.testOrders
  const automations = (shell.data?.apps ?? []).some((a) => a.installed && a.id === 'automations')
  const perPage = parseRowsPerPage(q.perPage)
  const tagSuggestions = [...new Set(items.flatMap((o) => o.tags ?? []))]
  const columns = orderColumns(copy, fmt)
  const { page, query, status } = q
  const filtered = hasOrderFilters(q)
  const groups = orderFilterGroups(q, copy.filters, setFilters, facets.data ?? NO_ORDER_FACETS)
  const searching = query.length > 0 || filtered
  const tabEmpty = status === 'archived' ? copy.emptyArchived : copy.emptyView
  const tabCounts: Partial<Record<OrderListFilter, number>> = {
    unpaid: counts.data.unpaid,
    unfulfilled: counts.data.unfulfilled,
    [PENDING_UPI]: counts.data.pendingUpi,
  }

  return (
    <ProoflyListPage
      title={copy.title}
      summary={copy.summary(counts.data.all, tiles.data.readyToShip, counts.data.pendingUpi)}
      actions={
        <OrdersHeaderActions
          testOrders={testOrders}
          onDeleteTests={() => setAskDeleteTests(true)}
          loadViewIds={loadViewIds}
        />
      }
      stats={
        <OrdersTiles
          tiles={tiles.data}
          status={status}
          onSelect={(s) => setQ({ status: s, page: 1 })}
        />
      }
    >
      {list.isError ? (
        <InlineState kind="error" heading={copy.loadFailed} onRetry={() => list.refetch()} />
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
            onChanged={() => void reload()}
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
        loading={list.isFetching && list.isPlaceholderData}
        defaultSort={DEFAULT_SORT}
        sort={parseSort(sort)}
        onSortChange={(s) => setSort(sortParam(s))}
        columnsStorageKey="orders:columns"
        defaultHidden={['fulfilment', 'channel', 'items', 'phone', 'city']}
        query={query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', status: null, ...NO_FILTERS, page: 1 })}
        filterGroups={groups}
        views={
          <ViewSelect<OrderListFilter | null>
            label={copy.viewLabel}
            value={status}
            onChange={(s) => setQ({ status: s, page: 1 })}
            formatCount={fmt.number}
            custom={
              filtered || query.length > 0
                ? { label: status ? copy.tabs[status] : copy.customView, count: total }
                : undefined
            }
            options={[
              { value: null, label: copy.tabs.all, count: counts.data.all },
              ...ORDER_LIST_FILTERS.map((s) => {
                const count = tabCounts[s]
                return { value: s, label: copy.tabs[s], ...(count === undefined ? {} : { count }) }
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
            appActions={appActions.data ?? []}
            automations={automations}
            onAppActionDone={() => {
              clear()
              void reload()
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
          void reload()
        }}
      />
      <DeleteTestOrdersDialog
        open={askDeleteTests}
        onOpenChange={setAskDeleteTests}
        count={testOrders}
        onDeleted={() => void reload()}
      />
    </ProoflyListPage>
  )
}
