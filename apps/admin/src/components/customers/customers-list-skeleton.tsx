'use client'

import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { customersContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { customerFilterGroups, NO_CUSTOMER_FILTERS } from '@/lib/customer-list-filters'
import { customerColumns } from './customer-columns'

type CustomersListSkeletonProps = {
  /** Rows per page the list will show (the skeleton draws a few of them). */
  perPage?: number
}

/* The header's three buttons (Export, Segments, Add customer). No stat strip (28 Nov). */
const HEADER_ACTIONS = 3

function noop() {}

/**
 * The Customers list while its route loads (`customers/loading.tsx`): the real page title and
 * the real ResourceTable in its loading state
 * with the Customers columns, toolbar, view select and filter button, as the Orders list does.
 * The table header and its column widths are the loaded page's own, so nothing moves when the
 * customers arrive.
 */
export default function CustomersListSkeleton({ perPage = 25 }: CustomersListSkeletonProps) {
  // Hooks
  const copy = useCopy(customersContent)

  // Render logic
  const table = (
    <ResourceTable
      resourceName={copy.resource}
      columns={customerColumns(copy)}
      items={[]}
      getId={(c) => c.id}
      href={() => ''}
      rowActions={() => null}
      loading
      query=""
      onQueryChange={noop}
      filterGroups={customerFilterGroups(NO_CUSTOMER_FILTERS, copy.filters, [], noop)}
      views={
        <ViewSelect<null>
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

  return <ListPageSkeleton title={copy.heading} actions={HEADER_ACTIONS} tiles={0} table={table} />
}
