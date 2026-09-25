'use client'

import { PackageCheck } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { shipmentsContent } from '@/data/shipments'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import BookShipmentsPanel from './book-shipments-panel'
import CourierCompareTable from './courier-compare-table'

type ListResult = Awaited<ReturnType<typeof api.shipments.readyToShip>>
type Row = ListResult['items'][number]
type CompareRows = Awaited<ReturnType<typeof api.shipments.compareRates>>
type BookResult = Awaited<ReturnType<typeof api.shipments.bulkBook>>

type ReadyToShipTabProps = {
  onSwitchToPickups: () => void
}

const copy = shipmentsContent.readyToShip
const PER_PAGE = 25

const date = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })

const COLUMNS: ResourceColumnSpec<Row>[] = [
  {
    id: 'order',
    title: copy.columns.order,
    render: (r) => (
      <Link href={`/orders/${r.orderId}`} className="font-medium hover:underline">
        #{r.orderNumber}
      </Link>
    ),
    sortValue: (r) => r.orderNumber,
    className: 'w-20',
  },
  {
    id: 'date',
    title: copy.columns.date,
    render: (r) => date.format(new Date(r.placedAt)),
    sortValue: (r) => new Date(r.placedAt).getTime(),
    className: 'w-24',
  },
  {
    id: 'customer',
    title: copy.columns.customer,
    render: (r) => (
      <div className="flex items-center gap-1.5">
        <span className="truncate">{r.customerName ?? r.email ?? '—'}</span>
        {r.isPreorder ? (
          <Badge variant="outline" className="shrink-0">
            {copy.preorder}
          </Badge>
        ) : null}
      </div>
    ),
  },
  {
    id: 'destination',
    title: copy.columns.destination,
    render: (r) => `${r.city}, ${r.pincode}`,
  },
  { id: 'items', title: copy.columns.items, render: (r) => r.itemsCount, align: 'end' },
  {
    id: 'amount',
    title: copy.columns.amount,
    render: (r) => formatPaise(r.totalPaise),
    sortValue: (r) => r.totalPaise,
    align: 'end',
  },
]

/** Shopify-style booking flow: paid orders waiting on a label, select some, compare couriers,
 *  book, then jump straight to printing labels or scheduling the pickup. */
export default function ReadyToShipTab({ onSwitchToPickups }: ReadyToShipTabProps) {
  // Hooks
  const [result, setResult] = useState<ListResult | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [pending, setPending] = useState<{ orderIds: string[]; clear: () => void } | null>(null)
  const [compareRows, setCompareRows] = useState<CompareRows | null>(null)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [booking, setBooking] = useState(false)
  const [bookResult, setBookResult] = useState<BookResult | null>(null)

  useEffect(() => {
    // reloadKey has no bearing on the query itself; bumping it just re-runs this effect
    // after a booking, the same way shipments-tab.tsx re-runs its list on demand.
    if (reloadKey < 0) return
    let cancelled = false
    api.shipments
      .readyToShip({ page, perPage: PER_PAGE, search: search || undefined })
      .then((r) => {
        if (!cancelled) setResult(r)
      })
    return () => {
      cancelled = true
    }
  }, [page, search, reloadKey])

  // Helpers
  const book = async (orderIds: string[], courierOverrides: Record<string, string>) => {
    setBooking(true)
    try {
      const r = await api.shipments.bulkBook({
        orderIds,
        courierOverrides: Object.keys(courierOverrides).length > 0 ? courierOverrides : undefined,
      })
      setBookResult(r)
      setCompareRows(null)
      setOverrides({})
      pending?.clear()
      setPending(null)
      setReloadKey((k) => k + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBooking(false)
    }
  }

  // Event handlers
  const handleStart = (selectedIds: string[], clear: () => void) => {
    setBookResult(null)
    setPending({ orderIds: selectedIds, clear })
  }

  const handleCompare = async () => {
    if (!pending) return
    setBooking(true)
    try {
      const rows = await api.shipments.compareRates({ orderIds: pending.orderIds })
      const multiCourier = rows.some((r) => r.options.length > 1)
      if (multiCourier) {
        setCompareRows(rows)
      } else {
        await book(pending.orderIds, {})
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBooking(false)
    }
  }

  const handleConfirmBook = () => {
    if (!pending) return
    void book(pending.orderIds, overrides)
  }

  const handleOverrideChange = (orderId: string, providerId: string) => {
    setOverrides((prev) => {
      const next = { ...prev }
      if (providerId) next[orderId] = providerId
      else delete next[orderId]
      return next
    })
  }

  const handlePrintLabels = () => {
    for (const r of bookResult ?? []) {
      if (r.ok && r.labelUrl) window.open(r.labelUrl, '_blank', 'noopener')
    }
  }

  // Render logic
  const okCount = bookResult?.filter((r) => r.ok).length ?? 0

  return (
    <div className="flex flex-col gap-4">
      <ResourceTable
        resourceName={{ singular: 'order', plural: 'orders' }}
        columns={COLUMNS}
        items={result?.items ?? []}
        getId={(r) => r.orderId}
        loading={result === null}
        query={search}
        onQueryChange={(q) => {
          setPage(1)
          setSearch(q)
        }}
        page={page}
        perPage={PER_PAGE}
        total={result?.total ?? 0}
        onPageChange={setPage}
        selectable
        bulkActions={(selectedIds, clear) => (
          <Button size="sm" onClick={() => handleStart(selectedIds, clear)} disabled={booking}>
            {copy.compareAndBook(selectedIds.length)}
          </Button>
        )}
        empty={{ heading: copy.empty }}
      />

      {pending && !compareRows ? (
        <div className="flex items-center gap-2">
          <Button onClick={handleCompare} disabled={booking}>
            {booking ? copy.booking : copy.compareAndBook(pending.orderIds.length)}
          </Button>
        </div>
      ) : null}

      {pending && compareRows ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <CourierCompareTable
            rows={compareRows}
            overrides={overrides}
            onOverrideChange={handleOverrideChange}
          />
          <Button className="w-fit" onClick={handleConfirmBook} disabled={booking}>
            {booking ? copy.booking : copy.compareAndBook(compareRows.length)}
          </Button>
        </div>
      ) : null}

      {bookResult ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
          <PackageCheck className="size-5 text-success" />
          <span className="text-body font-medium text-foreground">{copy.booked(okCount)}</span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrintLabels}>
              {copy.printLabels}
            </Button>
            <Button variant="outline" size="sm" onClick={onSwitchToPickups}>
              {copy.schedulePickup}
            </Button>
          </div>
        </div>
      ) : null}

      <Collapsible>
        <CollapsibleTrigger className="text-caption text-muted-foreground hover:text-foreground">
          {copy.advanced}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <BookShipmentsPanel onBooked={() => setReloadKey((k) => k + 1)} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
