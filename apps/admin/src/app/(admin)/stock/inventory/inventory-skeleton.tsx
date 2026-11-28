'use client'

import { inventoryColumns } from '@/components/inventory/inventory-columns'
import InventoryStrip from '@/components/inventory/inventory-strip'
import type { InventoryLine } from '@/components/inventory/inventory-tree'
import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { inventoryContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'
import {
  type InventoryQuery,
  inventoryFilterGroups,
  NO_INVENTORY_FACETS,
  PER_PAGE,
} from './inventory-query'

/* Export and Add location. No stat strip (28 Nov). */
const HEADER_ACTIONS = 2

const FIRST_PAGE: InventoryQuery = {
  page: 1,
  perPage: PER_PAGE,
  query: '',
  stock: null,
  vendor: [],
  productType: [],
  tag: [],
  collection: [],
  productStatus: [],
  changed: null,
  group: 'product',
}

const NO_LINES: InventoryLine[] = []

function noop() {}

/**
 * Inventory while its route loads (`inventory/loading.tsx`): the real title, the location,
 * Show and reason row, and the real ResourceTable in its loading state
 * with the inventory columns, view select and filter button, so nothing moves when stock arrives.
 */
export default function InventorySkeleton() {
  // Hooks
  const copy = useCopy(inventoryContent)

  // Render logic
  const table = (
    <ResourceTable
      resourceName={copy.resource}
      columns={inventoryColumns({
        copy,
        canEdit: true,
        lowAt: 0,
        onCommit: async () => false,
        tree: { expanded: {}, onToggle: noop },
      })}
      items={NO_LINES}
      getId={(r) => r.variantId}
      tree={{ getSubRows: (r) => r.variants, expanded: {}, onExpandedChange: noop }}
      rowActions={() => null}
      loading
      query=""
      onQueryChange={noop}
      filterGroups={inventoryFilterGroups(FIRST_PAGE, copy.filters, NO_INVENTORY_FACETS, noop)}
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

  return (
    <ListPageSkeleton
      title={copy.heading}
      actions={HEADER_ACTIONS}
      controls={
        <InventoryStrip
          locations={[]}
          locationId=""
          onLocationChange={noop}
          reason="correction"
          onReasonChange={noop}
          byProduct
          onByProductChange={noop}
          allExpanded={null}
          onExpandAll={noop}
        />
      }
      tiles={0}
      table={table}
    />
  )
}
