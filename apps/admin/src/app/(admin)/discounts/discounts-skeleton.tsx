'use client'

import { siteConfig } from '@commerce/config/site'
import { DISCOUNT_HIDDEN_COLUMNS, discountColumns } from '@/components/discounts/discount-columns'
import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { discountsContent } from '@/data/discounts'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { discountFilterGroups, NO_DISCOUNT_FILTERS } from '@/lib/discount-list-filters'

/* Create discount. No stat strip (28 Nov). */
const HEADER_ACTIONS = 1

function noop() {}

/**
 * The Discounts list while its route loads, as Orders and Products do it: the real title and
 * the real ResourceTable in its loading state with the
 * discount columns, view select and filter button, so nothing moves when the rows arrive.
 */
export default function DiscountsSkeleton() {
  // Hooks
  const copy = useCopy(discountsContent)
  const fmt = useFormat()

  // Render logic
  const table = (
    <ResourceTable
      resourceName={copy.resource}
      columns={discountColumns(copy, fmt)}
      defaultHidden={DISCOUNT_HIDDEN_COLUMNS}
      items={[]}
      getId={(d) => d.id}
      href={() => ''}
      rowActions={() => null}
      loading
      query=""
      onQueryChange={noop}
      filterGroups={discountFilterGroups(NO_DISCOUNT_FILTERS, copy.filters, noop)}
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
      selectable
    />
  )

  return <ListPageSkeleton title={copy.title} actions={HEADER_ACTIONS} tiles={0} table={table} />
}
