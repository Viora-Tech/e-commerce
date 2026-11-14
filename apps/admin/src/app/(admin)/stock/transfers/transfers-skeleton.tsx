'use client'

import { siteConfig } from '@commerce/config/site'
import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { type TransferRow, transferColumns } from '@/components/transfers/transfer-columns'
import { filterPanelContent } from '@/data/filter-panel'
import { transfersContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'
import { NO_TRANSFER_FILTERS, transferFilterGroups } from '@/lib/transfer-list-filters'

/* Create transfer; the list has no stat strip. */
const HEADER_ACTIONS = 1
const PER_PAGE = siteConfig.ui.rowsPerPage.default
const NO_ROWS: TransferRow[] = []

function noop() {}

/**
 * Transfers while the route loads: the real title and the real ResourceTable in its loading
 * state with the transfer columns, view select and filter button.
 */
export default function TransfersSkeleton() {
  // Hooks
  const copy = useCopy(transfersContent)
  const panelCopy = useCopy(filterPanelContent)

  // Render logic
  const table = (
    <ResourceTable
      resourceName={copy.resource}
      columns={transferColumns(copy)}
      items={NO_ROWS}
      getId={(r) => r.id}
      href={() => ''}
      rowActions={() => null}
      loading
      selectable={false}
      query=""
      onQueryChange={noop}
      filterGroups={transferFilterGroups(
        NO_TRANSFER_FILTERS,
        copy.filters,
        copy.status,
        panelCopy,
        [],
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
