'use client'

import {
  SHIPMENT_TAB_ON_PICKUP,
  SHIPMENT_TAB_STATUSES,
  SHIPMENT_TABS,
  type ShipmentTab,
} from '@commerce/core/shipment-tabs'
import { Clock, Settings, Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import AppStoreLink from '@/components/apps/app-store-link'
import EmptyState from '@/components/layout/empty-state'
import PillTabs from '@/components/layout/pill-tabs'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import StatusChip from '@/components/layout/status-chip'
import BookByNumberDialog from '@/components/shipments/book-by-number-dialog'
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
  type ShipmentFilters,
  shipmentFilterGroups,
  shipmentFilterInput,
} from '@/lib/shipment-list-filters'
import CreateShipmentDialog from './create-shipment/create-shipment-dialog'
import {
  rowFromOrder,
  rowFromShipment,
  type ShipmentRow,
  shipmentColumns,
} from './shipment-columns'
import ShipmentRowMenu from './shipment-row-menu'
import ShipmentsBulkActions from './shipments-bulk-actions'
import WalletStrip from './wallet-strip'

type Counts = Awaited<ReturnType<typeof api.shipments.counts>>
type Wallets = Awaited<ReturnType<typeof api.shipments.wallets>>

type Query = { tab: ShipmentTab; page: number; query: string } & ShipmentFilters

/** One tab's page of rows: orders to book, or shipments in the tab's statuses and the panel's filters. */
async function fetchTab(q: Query, perPage: number) {
  const search = q.query || undefined
  if (q.tab === 'toBook') {
    const r = await api.shipments.readyToShip({ page: q.page, perPage, search })
    return { items: r.items.map(rowFromOrder), total: r.total }
  }
  const r = await api.shipments.list({
    page: q.page,
    perPage,
    search,
    status: SHIPMENT_TAB_STATUSES[q.tab],
    onPickup: SHIPMENT_TAB_ON_PICKUP[q.tab],
    ...shipmentFilterInput(q),
  })
  return { items: r.items.map(rowFromShipment), total: r.total }
}

/** Live balances first: a courier that shares its balance is asked again on each visit. */
async function fetchWallets(): Promise<Wallets> {
  const wallets = await api.shipments.wallets()
  const live = wallets.filter((w) => w.supportsLiveBalance)
  if (live.length === 0) return wallets
  await Promise.allSettled(live.map((w) => api.shipments.refreshWallet({ providerId: w.provider })))
  return api.shipments.wallets()
}

function ShipmentsContent() {
  // Hooks
  const copy = useCopy(shipmentsContent)
  const partsCopy = useCopy(shipmentPartsContent)
  const filterCopy = useCopy(shipmentFiltersContent)
  const router = useRouter()
  const fmt = useFormat()
  const [q, setQ] = useQueryStates(
    {
      tab: parseAsStringLiteral(SHIPMENT_TABS).withDefault('toBook'),
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
  const [wallets, setWallets] = useState<Wallets | null>(null)
  const [couriers, setCouriers] = useState<{ labels: Map<string, string>; enabled: string[] }>({
    labels: new Map(),
    enabled: [],
  })
  /** Couriers this store's shipments went with: the Courier filter's options. */
  const [usedCouriers, setUsedCouriers] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  /** To book row id (a parcel, or an order shipping whole) -> its order, across pages ticked. */
  const [rowOrders, setRowOrders] = useState<Map<string, string>>(new Map())
  const [booking, setBooking] = useState<string[]>([])
  const [byNumber, setByNumber] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  // Counts, wallets and courier names: once, and again after a booking.
  useEffect(() => {
    if (reloadKey < 0) return
    let live = true
    api.shipments.counts().then((c) => live && setCounts(c))
    api.orders.couriers().then(
      (c) => live && setUsedCouriers(c),
      () => undefined,
    )
    fetchWallets()
      .then((w) => live && setWallets(w))
      .catch(() => live && setWallets([]))
    api.store.getShipping().then((r) => {
      if (!live) return
      setCouriers({
        labels: new Map(r.available.map((p) => [p.id, p.label])),
        enabled: r.settings.enabled,
      })
    })
    return () => {
      live = false
    }
  }, [reloadKey])
  // The open tab's rows.
  useEffect(() => {
    if (reloadKey < 0) return
    let live = true
    setLoading(true)
    fetchTab(q, parseRowsPerPage(q.perPage))
      .then((r) => {
        if (!live) return
        setRows(r.items)
        setTotal(r.total)
        setRowOrders(
          (m) => new Map([...m, ...r.items.map((i): [string, string] => [i.id, i.orderId])]),
        )
      })
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [q, reloadKey])

  // Helpers
  const courierName = (id: string) => couriers.labels.get(id) ?? id

  // Event handlers
  const handleTab = (next: ShipmentTab) => {
    setSelected([])
    // To book lists orders, which the shipment filters don't apply to.
    setQ({ tab: next, page: 1, ...(next === 'toBook' ? CLEAR_SHIPMENT_FILTERS : {}) })
  }
  const handleBooked = () => {
    setSelected([])
    setReloadKey((k) => k + 1)
  }
  const handlePrint = (ids: string[]) => {
    for (const r of rows) {
      if (ids.includes(r.id) && r.labelUrl) window.open(r.labelUrl, '_blank', 'noopener')
    }
  }
  /* One order opens the Create shipment page; several open the shared bulk dialog. */
  const handleBook = (orderIds: string[]) => {
    if (orderIds.length === 1 && orderIds[0]) router.push(routes.orders.shipment(orderIds[0]))
    else if (orderIds.length > 1) setBooking(orderIds)
  }
  /* To book rows are parcels (Part 2 of an order is its own row): the ticked rows' orders, each
     once; one parcel row opens Create shipment on that parcel. */
  const handleBookRows = (rowIds: string[]) => {
    const orderIds = [...new Set(rowIds.map((id) => rowOrders.get(id) ?? id))]
    const only = rows.find((r) => r.id === rowIds[0])
    if (rowIds.length === 1 && only?.fulfillmentOrderId) {
      router.push(routes.orders.shipment(only.orderId, only.fulfillmentOrderId))
    } else handleBook(orderIds)
  }
  /* Book by order number found these orders: the same Create shipment flow takes over. */
  const handleShipFound = (orderIds: string[]) => {
    setByNumber(false)
    handleBook(orderIds)
  }

  // Render logic
  const { tab, query, page } = q
  const groups = shipmentFilterGroups(
    q,
    filterCopy,
    (patch) => setQ({ ...patch, page: 1 }),
    usedCouriers.map((id) => ({ id, label: courierName(id) })),
  )
  const filterable = tab !== 'toBook'
  const toBookCourier =
    couriers.enabled.length === 1 && couriers.enabled[0]
      ? courierName(couriers.enabled[0])
      : copy.pickedAtBooking
  const noCourier = wallets !== null && wallets.length === 0
  const liveWallets = (wallets ?? []).filter((w) => w.supportsLiveBalance)
  const c = counts
  const lowWallet = liveWallets.some((w) => w.low)
  const summaryText = noCourier
    ? copy.summary.noCourier
    : !c
      ? undefined
      : tab === 'toBook'
        ? lowWallet
          ? copy.summary.lowWallet(c.toBook)
          : copy.summary.toBook(c.toBook, c.bookedToday)
        : copy.summary[tab](c[tab])
  const canBook = tab === 'toBook' && selected.length > 0

  return (
    <ProoflyListPage
      title={copy.title}
      summary={summaryText}
      actions={
        noCourier ? null : (
          <>
            {c && c.needsAttention > 0 ? (
              <Link
                href={routes.orders.shipmentProblems()}
                className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <StatusChip tone="danger">
                  {copy.summary.needsAttention(c.needsAttention)}
                </StatusChip>
              </Link>
            ) : null}
            {/* A "…" menu holding one item hid it; the button says what it does (audit #40). */}
            <Button variant="outline" onClick={() => setByNumber(true)}>
              {copy.byNumberSheet.title}
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={routes.orders.shipmentPickups()} />}
            >
              <Clock aria-hidden="true" />
              {copy.pickupsButton}
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={routes.settings.shipping()} />}
            >
              <Settings aria-hidden="true" />
              {copy.courierSettings}
            </Button>
            <Button
              onClick={() => handleBookRows(selected)}
              disabled={!canBook}
              title={canBook ? undefined : copy.bookSelectedHint}
            >
              <Truck aria-hidden />
              {copy.bookSelected}
            </Button>
          </>
        )
      }
    >
      {noCourier ? (
        <Card>
          <EmptyState
            icon={Truck}
            heading={copy.noCourier.heading}
            body={copy.noCourier.body}
            action={
              <AppStoreLink category="shipping" variant="default">
                {copy.noCourier.browse}
              </AppStoreLink>
            }
          />
        </Card>
      ) : (
        <>
          <WalletStrip wallets={liveWallets} />
          <ResourceTable
            resourceName={copy.resource}
            columns={shipmentColumns(copy, fmt, courierName, toBookCourier, partsCopy)}
            items={rows}
            getId={(r) => r.id}
            href={(r) => routes.orders.shipment(r.orderId, r.fulfillmentOrderId ?? undefined)}
            rowActions={(r) => (
              <span className="flex items-center gap-1">
                {tab === 'toBook' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(
                        routes.orders.shipment(r.orderId, r.fulfillmentOrderId ?? undefined),
                      )
                    }}
                  >
                    <Truck aria-hidden="true" />
                    {copy.shipNow}
                  </Button>
                ) : null}
                <ShipmentRowMenu row={r} onChanged={() => setReloadKey((k) => k + 1)} />
              </span>
            )}
            loading={loading}
            query={query}
            onQueryChange={(next) => setQ({ query: next, page: 1 })}
            onClearAll={() => setQ({ ...CLEAR_SHIPMENT_FILTERS, query: '', page: 1 })}
            {...(filterable ? { filterGroups: groups } : {})}
            views={
              // The shipping pipeline in plain sight (To book → … → RTO), not behind a dropdown
              // (audit #39).
              <PillTabs<ShipmentTab>
                value={tab}
                onChange={handleTab}
                tabs={SHIPMENT_TABS.map((t) => ({
                  value: t,
                  label: copy.tabs[t],
                  ...(c ? { count: c[t] } : {}),
                }))}
              />
            }
            page={page}
            perPage={parseRowsPerPage(q.perPage)}
            total={total}
            onPageChange={(p) => setQ({ page: p })}
            onPerPageChange={(n) => setQ({ perPage: n, page: 1 })}
            selection={{ ids: selected, onChange: setSelected }}
            bulkActions={(ids) =>
              tab === 'toBook' ? (
                <Button size="sm" onClick={() => handleBookRows(ids)}>
                  <Truck aria-hidden />
                  {copy.bookSelected}
                </Button>
              ) : (
                <ShipmentsBulkActions
                  ids={ids}
                  tab={tab}
                  onPrint={handlePrint}
                  onDone={handleBooked}
                />
              )
            }
            empty={{
              heading: filterable && hasShipmentFilters(q) ? filterCopy.noResults : copy.empty[tab],
            }}
          />
        </>
      )}
      <CreateShipmentDialog
        orderIds={booking}
        onClose={() => setBooking([])}
        onBooked={handleBooked}
      />
      <BookByNumberDialog open={byNumber} onOpenChange={setByNumber} onShip={handleShipFound} />
    </ProoflyListPage>
  )
}

/**
 * Orders → Shipments (Figma "Orders / Shipments"): To book, Booked, In transit, Delivered and
 * Returned (RTO) in one table, the courier wallet strip, Book selected for the orders ticked in
 * To book, booking by order number in a dialog, and links to the pickups and delivery-problem pages.
 */
export default function ShipmentsWorkspace() {
  return (
    <Suspense>
      <ShipmentsContent />
    </Suspense>
  )
}
