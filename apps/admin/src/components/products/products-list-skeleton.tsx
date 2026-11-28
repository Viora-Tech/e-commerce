'use client'

import { siteConfig } from '@commerce/config/site'
import { LOW_STOCK_THRESHOLD } from '@commerce/core/catalog'
import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { productsListContent } from '@/data/products'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { NO_PRODUCT_FILTERS, productFilterGroups } from '@/lib/product-list-filters'
import { productColumns } from './product-columns'

/* The header's three buttons (Import, Export, Add product). No stat strip (owner, 28 Nov). */
const HEADER_ACTIONS = 3

const NO_FACETS = { vendors: [], productTypes: [], tags: [], collections: [] }

function noop() {}

/**
 * The Products list while its route loads (`products/loading.tsx`), as the Orders list does it:
 * the real page title and the real ResourceTable in its loading state with the product columns, toolbar, view select and filter button, so the
 * header labels and column widths do not move when the products arrive.
 */
export default function ProductsListSkeleton() {
  // Hooks
  const copy = useCopy(productsListContent)
  const fmt = useFormat()

  // Render logic
  const table = (
    <ResourceTable
      resourceName={copy.resource}
      columns={productColumns(copy, fmt, LOW_STOCK_THRESHOLD)}
      items={[]}
      getId={(p) => p.id}
      href={() => ''}
      rowActions={() => null}
      loading
      query=""
      onQueryChange={noop}
      filterGroups={productFilterGroups(NO_PRODUCT_FILTERS, copy.filters, NO_FACETS, noop)}
      views={
        <ViewSelect<null>
          value={null}
          onChange={noop}
          options={[{ value: null, label: copy.tabs.all }]}
          pending
        />
      }
      page={1}
      perPage={siteConfig.ui.rowsPerPage.default}
      total={0}
      onPageChange={noop}
      onPerPageChange={noop}
    />
  )

  return <ListPageSkeleton title={copy.title} actions={HEADER_ACTIONS} tiles={0} table={table} />
}
