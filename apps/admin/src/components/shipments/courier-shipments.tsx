'use client'

import {
  SHIPMENT_TAB_ON_PICKUP,
  SHIPMENT_TAB_STATUSES,
  SHIPMENT_TABS,
  type ShipmentTab,
} from '@commerce/core/shipment-tabs'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import ResourceTable from '@/components/table/resource-table'
import { shipmentFiltersContent } from '@/data/order-list-filters'
import { shipmentPartsContent, shipmentsContent } from '@/data/shipments'
import { useCopy, useFormat } from '@/hooks/use-copy'
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
import { rowFromShipment, type ShipmentRow, shipmentColumns } from './shipment-columns'
import ShipmentRowMenu from './shipment-row-menu'
import ShipmentsBulkActions from './shipments-bulk-actions'

type BookedTab = Exclude<ShipmentTab, 'toBook'>
type Counts = Awaited<ReturnType<typeof api.shipments.counts>>

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
  const filterCopy = useCopy(shipmentFiltersContent)
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
  const [rows, setRows] = useState<ShipmentRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    if (reloadKey < 0) return
    let live = true
    api.shipments
      .counts({ provider })
      .then((c) => live && setCounts(c))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [provider, reloadKey])
  useEffect(() => {
    if (reloadKey < 0) return
    let live = true
    setLoading(true)
    api.shipments
      .list({
        page: q.page,
        perPage: parseRowsPerPage(q.perPage),
        search: q.query || undefined,
        status: SHIPMENT_TAB_STATUSES[q.tab],
        onPickup: SHIPMENT_TAB_ON_PICKUP[q.tab],
        ...shipmentFilterInput(q),
        // After the panel's filters: this page is one courier's, whatever the URL says.
        provider,
      })
      .then((r) => {
        if (!live) return
        setRows(r.items.map(rowFromShipment))
        setTotal(r.total)
      })
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [q, provider, reloadKey])

  // Event handlers
  const handleTab = (next: BookedTab) => {
    setSelected([])
    setQ({ tab: next, page: 1 })
  }
  const handleDone = () => {
    setSelected([])
    setReloadKey((k) => k + 1)
  }
  const handlePrint = (ids: string[]) => {
    for (const r of rows) {
      if (ids.includes(r.id) && r.labelUrl) window.open(r.labelUrl, '_blank', 'noopener')
    }
  }

  // Render logic
  const { tab, query, page } = q
  // No Courier filter: the page is already one courier's.
  const groups = shipmentFilterGroups(q, filterCopy, (patch) => setQ({ ...patch, page: 1 }), [])
  const columns = shipmentColumns(copy, fmt, () => providerLabel, providerLabel, partsCopy).filter(
    (c) => c.id !== 'courier',
  )

  return (
    <ResourceTable
      resourceName={copy.resource}
      columns={columns}
      items={rows}
      getId={(r) => r.id}
      href={(r) => routes.orders.shipment(r.orderId, r.fulfillmentOrderId ?? undefined)}
      rowActions={(r) => <ShipmentRowMenu row={r} onChanged={handleDone} />}
      loading={loading}
      query={query}
      onQueryChange={(next) => setQ({ query: next, page: 1 })}
      onClearAll={() => setQ({ ...CLEAR_SHIPMENT_FILTERS, query: '', page: 1 })}
      filterGroups={groups}
      views={
        <PillTabs<BookedTab>
          value={tab}
          onChange={handleTab}
          tabs={TABS.map((t) => ({
            value: t,
            label: copy.tabs[t],
            ...(counts ? { count: counts[t] } : {}),
          }))}
        />
      }
      page={page}
      perPage={parseRowsPerPage(q.perPage)}
      total={total}
      onPageChange={(p) => setQ({ page: p })}
      onPerPageChange={(n) => setQ({ perPage: n, page: 1 })}
      selection={{ ids: selected, onChange: setSelected }}
      bulkActions={(ids) => (
        <ShipmentsBulkActions ids={ids} tab={tab} onPrint={handlePrint} onDone={handleDone} />
      )}
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
