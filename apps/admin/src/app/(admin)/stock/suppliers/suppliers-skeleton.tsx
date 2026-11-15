'use client'

import { siteConfig } from '@commerce/config/site'
import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import { type SupplierRow, supplierColumns } from '@/components/suppliers/supplier-columns'
import ResourceTable from '@/components/table/resource-table'
import { suppliersContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { NO_SUPPLIER_FILTERS, supplierFilterGroups } from '@/lib/supplier-list-filters'

/* Add supplier; the list has no stat strip or view select. */
const HEADER_ACTIONS = 1
const PER_PAGE = siteConfig.ui.rowsPerPage.default
const NO_ROWS: SupplierRow[] = []
const NO_FACETS = { countries: [], currencies: [] }

function noop() {}

/**
 * Suppliers while the route loads: the real title and the real ResourceTable in its loading
 * state with the supplier columns and filter button.
 */
export default function SuppliersSkeleton() {
  // Hooks
  const copy = useCopy(suppliersContent)

  // Render logic
  const table = (
    <ResourceTable
      resourceName={copy.resource}
      columns={supplierColumns(copy)}
      items={NO_ROWS}
      getId={(r) => r.id}
      href={() => ''}
      rowActions={() => null}
      bulkActions={() => null}
      loading
      query=""
      onQueryChange={noop}
      filterGroups={supplierFilterGroups(NO_SUPPLIER_FILTERS, copy.filters, NO_FACETS, noop)}
      page={1}
      perPage={PER_PAGE}
      total={0}
      onPageChange={noop}
      onPerPageChange={noop}
    />
  )

  return <ListPageSkeleton title={copy.heading} actions={HEADER_ACTIONS} tiles={0} table={table} />
}
