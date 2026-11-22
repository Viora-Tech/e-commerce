'use client'

import {
  SHIPMENT_TAB_ON_PICKUP,
  SHIPMENT_TAB_STATUSES,
  SHIPMENT_TABS,
  type ShipmentTab,
} from '@commerce/core/shipment-tabs'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import ResourceTable from '@/components/table/resource-table'
import { appsContent } from '@/data/apps'
import { shipmentFiltersContent } from '@/data/order-list-filters'
import { shipmentLostContent } from '@/data/shipment-lost'
import { shipmentPartsContent, shipmentsContent } from '@/data/shipments'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { parseRowsPerPage } from '@/lib/rows-per-page'
import {
  CLEAR_SHIPMENT_FILTERS,
  hasShipmentFilters,
  SHIPMENT_FILTER_PARAMS,
  shipmentFilterGroups,
  shipmentFilterInput,
} from '@/lib/shipment-list-filters'
import PrintManifestsButton from './print-manifests-button'
import { rowFromShipment, type ShipmentRow, shipmentColumns } from './shipment-columns'
import ShipmentRowMenu from './shipment-row-menu'
import ShipmentsBulkActions from './shipments-bulk-actions'

type BookedTab = Exclude<ShipmentTab, 'toBook'>
type CourierShipmentsProps = {
  /** The courier id (`shipment.provider`); only its shipments are listed and counted. */
  provider: string
  providerLabel: string
}

/** The booked tabs: "To book" lists orders not yet given to any courier, so a courier app skips it. */
const TABS = SHIPMENT_TABS.filter((t): t is BookedTab => t !== 'toBook')

function CourierShipmentsContent({ provider, providerLabel }: CourierShipmentsProps) {
  // Hooks
  const copy = useCopy(shipmentsContent)
  const partsCopy = useCopy(shipmentPartsContent)
  const lostCopy = useCopy(shipmentLostContent)
  const filterCopy = useCopy(shipmentFiltersContent)
  const apps = useCopy(appsContent)
  const fmt = useFormat()
  const [q, setQ] = useQueryStates(
    {
      tab: parseAsStringLiteral(TABS).withDefault('booked'),
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger,
      ...SHIPMENT_FILTER_PARAMS,
    },
    { shallow: true },
  )
  const [selected, setSelected] = useState<string[]>([])
  const [reloadKey, setReloadKey] = useState(0)
  // A failed count read leaves the tabs without counts.
  const { data: counts } = useLoad(() => api.shipments.counts({ provider }), [provider, reloadKey])
  const { data, failed, loading, retry } = useLoad(
    () =>
      api.shipments.list({
        page: q.page,
        perPage: parseRowsPerPage(q.perPage),
        search: q.query || undefined,
        status: SHIPMENT_TAB_STATUSES[q.tab],
        onPickup: SHIPMENT_TAB_ON_PICKUP[q.tab],
        ...shipmentFilterInput(q),
        // After the panel's filters: this page is one courier's, whatever the URL says.
        provider,
      }),
    [q, provider, reloadKey],
  )

  // Event handlers
  const handleTab = (next: BookedTab) => {
    setSelected([])
    setQ({ tab: next, page: 1 })
  }
  const handleDone = () => {
    setSelected([])
    setReloadKey((k) => k + 1)
  }

  // Render logic
  const rows: ShipmentRow[] = data ? data.items.map(rowFromShipment) : []
  const total = data?.total ?? 0
  const { tab, query, page } = q
  // No Courier filter: the page is already one courier's.
  const groups = shipmentFilterGroups(q, filterCopy, (patch) => setQ({ ...patch, page: 1 }), [])
  const columns = shipmentColumns(
    copy,
    fmt,
    () => providerLabel,
    providerLabel,
    partsCopy,
    lostCopy,
  ).filter((c) => c.id !== 'courier')

  return (
    <ResourceTable
      resourceName={copy.resource}
      columns={columns}
      items={rows}
      getId={(r) => r.id}
      href={(r) => routes.orders.shipment(r.orderId, r.fulfillmentOrderId ?? undefined)}
      rowActions={(r) => <ShipmentRowMenu row={r} onChanged={handleDone} />}
      loading={loading}
      error={failed ? { heading: apps.couldNotLoad.shipments, onRetry: retry } : undefined}
      query={query}
      onQueryChange={(next) => setQ({ query: next, page: 1 })}
      onClearAll={() => setQ({ ...CLEAR_SHIPMENT_FILTERS, query: '', page: 1 })}
      filterGroups={groups}
      views={
        <div className="flex flex-wrap items-center gap-2">
          <PillTabs<BookedTab>
            value={tab}
            onChange={handleTab}
            tabs={TABS.map((t) => ({
              value: t,
              label: copy.tabs[t],
              ...(counts ? { count: counts[t] } : {}),
            }))}
          />
          {tab === 'toPickUp' && total > 0 ? <PrintManifestsButton provider={provider} /> : null}
        </div>
      }
      page={page}
      perPage={parseRowsPerPage(q.perPage)}
      total={total}
      onPageChange={(p) => setQ({ page: p })}
      onPerPageChange={(n) => setQ({ perPage: n, page: 1 })}
      selection={{ ids: selected, onChange: setSelected }}
      bulkActions={(ids) => <ShipmentsBulkActions ids={ids} tab={tab} onDone={handleDone} />}
      empty={{ heading: hasShipmentFilters(q) ? filterCopy.noResults : copy.empty[tab] }}
    />
  )
}

/**
 * One courier's shipments (a courier app's Shipments page): the Shipments workspace's table,
 * tabs, filters, row menu and bulk actions over `shipments.list` with `provider`, without the
 * To book tab, whose orders have no courier yet.
 */
export default function CourierShipments(props: CourierShipmentsProps) {
  return (
    <Suspense>
      <CourierShipmentsContent {...props} />
    </Suspense>
  )
}
