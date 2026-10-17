'use client'

import {
  SHIPMENT_TAB_STATUSES,
  SHIPMENT_TABS,
  type ShipmentTab,
} from '@commerce/core/shipment-tabs'
import { AppWindow, Plus, Printer, Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import ActionMenu from '@/components/layout/action-menu'
import EmptyState from '@/components/layout/empty-state'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import StatusChip from '@/components/layout/status-chip'
import ResourceTable from '@/components/table/resource-table'
import RowMenu from '@/components/table/row-menu'
import ViewSelect from '@/components/table/view-select'
import { shipmentsContent } from '@/data/shipments'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { parseRowsPerPage } from '@/lib/rows-per-page'
import CreateShipmentDialog from './create-shipment/create-shipment-dialog'
import {
  rowFromOrder,
  rowFromShipment,
  type ShipmentRow,
  shipmentColumns,
} from './shipment-columns'
import ShipmentSheets, { type SheetKind } from './shipment-sheets'
import WalletStrip from './wallet-strip'

type Counts = Awaited<ReturnType<typeof api.shipments.counts>>
type Wallets = Awaited<ReturnType<typeof api.shipments.wallets>>

/** One tab's page of rows: orders to book, or shipments in the tab's statuses. */
async function fetchTab(tab: ShipmentTab, page: number, perPage: number, query: string) {
  const search = query || undefined
  if (tab === 'toBook') {
    const r = await api.shipments.readyToShip({ page, perPage, search })
    return { items: r.items.map(rowFromOrder), total: r.total }
  }
  const r = await api.shipments.list({ page, perPage, search, status: SHIPMENT_TAB_STATUSES[tab] })
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
  const router = useRouter()
  const fmt = useFormat()
  const [{ tab, query, page, perPage: rawPerPage }, setQ] = useQueryStates(
    {
      tab: parseAsStringLiteral(SHIPMENT_TABS).withDefault('toBook'),
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger,
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
  const [selected, setSelected] = useState<string[]>([])
  const [booking, setBooking] = useState<string[]>([])
  const [sheet, setSheet] = useState<SheetKind | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  // Counts, wallets and courier names: once, and again after a booking or a sheet action.
  useEffect(() => {
    if (reloadKey < 0) return
    let live = true
    api.shipments.counts().then((c) => live && setCounts(c))
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
    fetchTab(tab, page, parseRowsPerPage(rawPerPage), query)
      .then((r) => {
        if (!live) return
        setRows(r.items)
        setTotal(r.total)
      })
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [tab, page, rawPerPage, query, reloadKey])

  // Helpers
  const courierName = (id: string) => couriers.labels.get(id) ?? id

  // Event handlers
  const handleTab = (next: ShipmentTab) => {
    setSelected([])
    setQ({ tab: next, page: 1 })
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
  const handleSheetClose = () => {
    setSheet(null)
    setReloadKey((k) => k + 1)
  }
  /* Book by order number found these orders: the same Create shipment flow takes over. */
  const handleShipFound = (orderIds: string[]) => {
    setSheet(null)
    if (orderIds.length === 1 && orderIds[0]) router.push(routes.orders.ship(orderIds[0]))
    else setBooking(orderIds)
  }

  // Render logic
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
              <button
                type="button"
                onClick={() => setSheet('ndr')}
                className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <StatusChip tone="danger">
                  {copy.summary.needsAttention(c.needsAttention)}
                </StatusChip>
              </button>
            ) : null}
            <ActionMenu
              label={copy.more}
              variant="outline"
              size="md"
              items={[{ label: copy.byNumberSheet.title, onSelect: () => setSheet('byNumber') }]}
            />
            <Button variant="outline" onClick={() => setSheet('pickups')}>
              {copy.pickupsButton}
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={routes.settings.shipping()} />}
            >
              {copy.courierSettings}
            </Button>
            <Button
              onClick={() => setBooking(selected)}
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
              <Button nativeButton={false} render={<Link href={routes.apps.list()} />}>
                <Plus aria-hidden />
                {copy.noCourier.browse}
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <WalletStrip wallets={liveWallets} />
          <ResourceTable
            resourceName={copy.resource}
            columns={shipmentColumns(copy, fmt, courierName, toBookCourier)}
            items={rows}
            getId={(r) => r.id}
            href={(r) => routes.orders.detail(r.orderId)}
            rowActions={(r) => (
              <span className="flex items-center gap-1">
                {tab === 'toBook' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(routes.orders.ship(r.orderId))
                    }}
                  >
                    {copy.shipNow}
                  </Button>
                ) : null}
                <RowMenu
                  items={[
                    {
                      label: copy.menu.viewOrder,
                      href: routes.orders.detail(r.orderId),
                      icon: AppWindow,
                    },
                    ...(r.labelUrl
                      ? [{ label: copy.menu.label, href: r.labelUrl, icon: Printer, newTab: true }]
                      : []),
                    ...(r.trackingUrl
                      ? [{ label: copy.menu.track, href: r.trackingUrl, icon: Truck, newTab: true }]
                      : []),
                  ]}
                />
              </span>
            )}
            loading={loading}
            query={query}
            onQueryChange={(q) => setQ({ query: q, page: 1 })}
            views={
              <ViewSelect<ShipmentTab>
                label={copy.viewLabel}
                value={tab}
                onChange={handleTab}
                formatCount={fmt.number}
                options={SHIPMENT_TABS.map((t) => ({
                  value: t,
                  label: copy.tabs[t],
                  ...(c ? { count: c[t] } : {}),
                }))}
              />
            }
            page={page}
            perPage={parseRowsPerPage(rawPerPage)}
            total={total}
            onPageChange={(p) => setQ({ page: p })}
            onPerPageChange={(n) => setQ({ perPage: n, page: 1 })}
            selection={{ ids: selected, onChange: setSelected }}
            bulkActions={(ids) =>
              tab === 'toBook' ? (
                <Button size="sm" onClick={() => setBooking(ids)}>
                  <Truck aria-hidden />
                  {copy.bookSelected}
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => handlePrint(ids)}>
                  <Printer aria-hidden />
                  {copy.printLabels}
                </Button>
              )
            }
            empty={{ heading: copy.empty[tab] }}
          />
        </>
      )}
      <CreateShipmentDialog
        orderIds={booking}
        onClose={() => setBooking([])}
        onBooked={handleBooked}
      />
      <ShipmentSheets open={sheet} onClose={handleSheetClose} onShip={handleShipFound} />
    </ProoflyListPage>
  )
}

/**
 * Orders → Shipments (Figma "Orders / Shipments"): To book, Booked, In transit, Delivered and
 * Returned (RTO) in one table, the courier wallet strip, Book selected for the orders ticked in
 * To book, and the pickups and delivery-problem queues in side sheets.
 */
export default function ShipmentsWorkspace() {
  return (
    <Suspense>
      <ShipmentsContent />
    </Suspense>
  )
}
