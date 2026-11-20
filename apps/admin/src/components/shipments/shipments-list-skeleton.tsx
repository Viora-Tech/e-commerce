'use client'

import { SHIPMENT_TABS, type ShipmentTab } from '@commerce/core/shipment-tabs'
import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import PillTabs from '@/components/layout/pill-tabs'
import ResourceTable from '@/components/table/resource-table'
import { shipmentLostContent } from '@/data/shipment-lost'
import { shipmentPartsContent, shipmentsContent } from '@/data/shipments'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { parseRowsPerPage } from '@/lib/rows-per-page'
import { shipmentColumns } from './shipment-columns'

/* The header's four buttons: Book by order number, Pickups, Courier settings, Book selected. */
const HEADER_ACTIONS = 4

function noop() {}

/**
 * Orders › Shipments while its route loads (`orders/shipments/loading.tsx`): the real title, the
 * four header buttons and the real ResourceTable in its loading state with the To book columns,
 * the selection boxes and the pipeline tabs (To book → … → RTO). The table header, its labels and
 * column widths are the loaded page's own, so nothing moves when the rows arrive (audit section 7
 * row 6; the same pattern as OrdersListSkeleton).
 */
export default function ShipmentsListSkeleton() {
  // Hooks
  const copy = useCopy(shipmentsContent)
  const partsCopy = useCopy(shipmentPartsContent)
  const lostCopy = useCopy(shipmentLostContent)
  const fmt = useFormat()

  // Render logic
  const table = (
    <ResourceTable
      resourceName={copy.resource}
      columns={shipmentColumns(copy, fmt, (id) => id, copy.pickedAtBooking, partsCopy, lostCopy)}
      items={[]}
      getId={(r) => r.id}
      href={() => ''}
      rowActions={() => null}
      loading
      query=""
      onQueryChange={noop}
      views={
        <PillTabs<ShipmentTab>
          value="toBook"
          onChange={noop}
          tabs={SHIPMENT_TABS.map((t) => ({ value: t, label: copy.tabs[t] }))}
        />
      }
      page={1}
      perPage={parseRowsPerPage(undefined)}
      total={0}
      onPageChange={noop}
      onPerPageChange={noop}
      selection={{ ids: [], onChange: noop }}
    />
  )

  return <ListPageSkeleton title={copy.title} actions={HEADER_ACTIONS} tiles={0} table={table} />
}
