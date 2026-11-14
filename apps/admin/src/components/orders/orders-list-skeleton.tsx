'use client'

import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { ordersContent } from '@/data/orders'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { orderColumns } from '@/lib/order-columns'
import { NO_FILTERS, orderFilterGroups } from '@/lib/order-list-filters'
import { ORDER_COLUMNS_KEY, ORDER_DEFAULT_SORT, ORDER_HIDDEN_COLUMNS } from '@/lib/order-list-table'

type OrdersListSkeletonProps = {
  /** Rows per page the list will show (the skeleton draws a few of them). */
  perPage?: number
}

/* The header's two buttons: More actions and Add order. The strip's four tiles. */
const HEADER_ACTIONS = 2
const TILES = 4

function noop() {}

/**
 * The Orders list while its route loads (`orders/loading.tsx`): the real page title, the four-cell
 * stat strip with skeleton figures, and the real ResourceTable in its loading state with the
 * Orders columns, toolbar, view select and filter button. The table header, its labels and the
 * column widths are the loaded page's own, so nothing moves when the orders arrive.
 */
export default function OrdersListSkeleton({ perPage = 25 }: OrdersListSkeletonProps) {
  // Hooks
  const copy = useCopy(ordersContent)
  const fmt = useFormat()

  // Render logic
  const table = (
    <ResourceTable
      resourceName={copy.resource}
      columns={orderColumns(copy, fmt)}
      items={[]}
      getId={(o) => o.id}
      href={() => ''}
      rowActions={() => null}
      loading
      defaultSort={ORDER_DEFAULT_SORT}
      columnsStorageKey={ORDER_COLUMNS_KEY}
      defaultHidden={ORDER_HIDDEN_COLUMNS}
      query=""
      onQueryChange={noop}
      filterGroups={orderFilterGroups(NO_FILTERS, copy.filters, noop)}
      views={
        <ViewSelect<null>
          label={copy.viewLabel}
          value={null}
          onChange={noop}
          options={[{ value: null, label: copy.tabs.all }]}
          pending
        />
      }
      page={1}
      perPage={perPage}
      total={0}
      onPageChange={noop}
      onPerPageChange={noop}
    />
  )

  return (
    <ListPageSkeleton title={copy.title} actions={HEADER_ACTIONS} tiles={TILES} table={table} />
  )
}
