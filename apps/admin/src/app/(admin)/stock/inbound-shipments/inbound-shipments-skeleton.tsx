'use client'

import { siteConfig } from '@commerce/config/site'
import {
  type InboundShipmentRow,
  inboundShipmentColumns,
} from '@/components/inbound-shipments/shipment-columns'
import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { filterPanelContent } from '@/data/filter-panel'
import { inboundShipmentsContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import {
  inboundShipmentFilterGroups,
  NO_INBOUND_SHIPMENT_FILTERS,
} from '@/lib/inbound-shipment-list-filters'

/* Create inbound shipment; the list has no stat strip. */
const HEADER_ACTIONS = 1
const PER_PAGE = siteConfig.ui.rowsPerPage.default
const NO_ROWS: InboundShipmentRow[] = []

function noop() {}

/**
 * Inbound shipments while the route loads: the real title and the real ResourceTable in its
 * loading state with the shipment columns, view select and filter button.
 */
export default function InboundShipmentsSkeleton() {
  // Hooks
  const copy = useCopy(inboundShipmentsContent)
  const panelCopy = useCopy(filterPanelContent)

  // Render logic
  const table = (
    <ResourceTable
      resourceName={copy.resource}
      columns={inboundShipmentColumns(copy)}
      items={NO_ROWS}
      getId={(r) => r.id}
      href={() => ''}
      rowActions={() => null}
      bulkActions={() => null}
      loading
      query=""
      onQueryChange={noop}
      filterGroups={inboundShipmentFilterGroups(
        NO_INBOUND_SHIPMENT_FILTERS,
        copy.filters,
        copy.status,
        panelCopy,
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
