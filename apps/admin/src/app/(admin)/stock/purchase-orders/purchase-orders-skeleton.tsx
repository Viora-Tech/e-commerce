'use client'

import { siteConfig } from '@commerce/config/site'
import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import {
  type PurchaseOrderRow,
  purchaseOrderColumns,
} from '@/components/purchase-orders/purchase-order-columns'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { filterPanelContent } from '@/data/filter-panel'
import { purchaseOrdersContent } from '@/data/inventory'
import { useCopy, useFormat } from '@/hooks/use-copy'
import {
  NO_PURCHASE_ORDER_FILTERS,
  purchaseOrderFilterGroups,
} from '@/lib/purchase-order-list-filters'

/* Create purchase order. No stat strip (28 Nov). */
const HEADER_ACTIONS = 1
const PER_PAGE = siteConfig.ui.rowsPerPage.default
const NO_ROWS: PurchaseOrderRow[] = []
const NO_FACETS = { suppliers: [], locations: [] }

function noop() {}

/**
 * Purchase orders while the route loads: the real title and the real
 * ResourceTable in its loading state with the list's columns, view select and filter button.
 */
export default function PurchaseOrdersSkeleton() {
  // Hooks
  const copy = useCopy(purchaseOrdersContent)
  const panelCopy = useCopy(filterPanelContent)
  const fmt = useFormat()

  // Render logic
  const table = (
    <ResourceTable
      resourceName={copy.resource}
      columns={purchaseOrderColumns(copy, fmt)}
      items={NO_ROWS}
      getId={(r) => r.id}
      href={() => ''}
      rowActions={() => null}
      bulkActions={() => null}
      loading
      query=""
      onQueryChange={noop}
      filterGroups={purchaseOrderFilterGroups(
        NO_PURCHASE_ORDER_FILTERS,
        copy.filters,
        copy.status,
        panelCopy,
        NO_FACETS,
        noop,
      )}
      views={
        <ViewSelect<null>
          value={null}
          onChange={noop}
          options={[{ value: null, label: copy.tabs.all }]}
          pending
        />
      }
      page={1}
      perPage={PER_PAGE}
      total={0}
      onPageChange={noop}
      onPerPageChange={noop}
    />
  )

  return <ListPageSkeleton title={copy.heading} actions={HEADER_ACTIONS} tiles={0} table={table} />
}
