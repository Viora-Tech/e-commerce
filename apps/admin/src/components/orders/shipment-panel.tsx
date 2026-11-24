'use client'

import type { Tracking } from '@commerce/core'
import { PackageCheck, RefreshCw, Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import RelativeTime from '@/components/layout/relative-time'
import ShipmentDetails from '@/components/shipments/shipment-details'
import { sharedParcelContent } from '@/data/shared-parcel'
import { shipmentPanelContent } from '@/data/shipping'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { OrderShipment } from './order-detail-types'

type ShipmentPanelProps = {
  /** The order's fulfilment status while open, else its lifecycle (completed, cancelled). */
  orderStatus: string
  shipment: OrderShipment
  busy: boolean
  onBook: () => void
  onRefresh: () => void
  /** After a cancel or a pickup request from the details: the order is read again. */
  onChanged: () => void
}

const SHORT_DATE = { day: 'numeric', month: 'short' } as const
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
/** Scans shown before "Show all": the latest few say where the parcel is. */
const SCANS_SHOWN = 3

/* Nothing to book once the order is closed or the parcel has arrived. */
const CLOSED: ReadonlySet<string> = new Set(['cancelled', 'completed', 'delivered', 'returned'])

/** The order's consignment: book one, or the booked shipment's details (AWB, payment, package,
 *  pickup, label, Cancel shipment) and the courier's scans. An order packed in another order's
 *  box shows that box, read-only, with "In the same box as #A"; the booked order lists the
 *  orders riding with it. */
export default function ShipmentPanel({
  orderStatus,
  shipment,
  busy,
  onBook,
  onRefresh,
  onChanged,
}: ShipmentPanelProps) {
  // Hooks
  const copy = useCopy(shipmentPanelContent)
  const shared = useCopy(sharedParcelContent)
  const fmt = useFormat()
  const [allScans, setAllScans] = useState(false)

  // Event handlers
  const handleToggleScans = () => setAllScans((v) => !v)

  // Early returns
  const canBook = !shipment || shipment.status === 'cancelled'
  const bookable = canBook && !CLOSED.has(orderStatus)
  if (!shipment || canBook) {
    return (
      <DataCard title={copy.heading}>
        <div className="flex items-center justify-between gap-4">
          <EmptyState variant="inline" body={copy.none} />
          {bookable ? (
            <Button onClick={onBook} disabled={busy}>
              <Truck aria-hidden="true" />
              {copy.book}
            </Button>
          ) : null}
        </div>
      </DataCard>
    )
  }

  // Render logic
  const tracking = (shipment.tracking ?? null) as Tracking | null
  const open = shipment.status !== 'cancelled' && shipment.status !== 'delivered'
  const events = tracking?.events.slice().reverse() ?? []
  const shownEvents = allScans ? events : events.slice(0, SCANS_SHOWN)
  const host = shipment.sameBoxAs
  const riders = shipment.alsoCarries
  // The courier's "2026-11-23" read as a calendar day: "23 Nov".
  const expectedDay = tracking?.expectedDate?.slice(0, 10) ?? ''
  const expected = ISO_DAY.test(expectedDay)
    ? fmt.pattern(`${expectedDay}T12:00:00Z`, SHORT_DATE)
    : (tracking?.expectedDate ?? null)

  return (
    <DataCard
      tone="muted"
      title={copy.heading}
      icon={<PackageCheck aria-hidden="true" />}
      meta={
        <span>
          {copy.updated} <RelativeTime value={shipment.updatedAt} />
          {expected ? `, ${copy.expected} ${expected}` : ''}
        </span>
      }
    >
      <div className="flex flex-col gap-5">
        {host ? (
          <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-background px-3 py-2.5">
            <Link
              href={routes.orders.detail(host.orderId)}
              className="text-body-strong text-link underline-offset-2 hover:underline"
            >
              {shared.inSameBox(host.number)}
            </Link>
            <span className="text-caption text-muted-foreground">{shared.inSameBoxHint}</span>
          </div>
        ) : null}
        {riders.length > 0 ? (
          <p className="flex flex-wrap items-center gap-x-1.5 text-body">
            <span className="text-muted-foreground">{shared.alsoCarries}</span>
            {riders.map((r) => (
              <Link
                key={r.orderId}
                href={routes.orders.detail(r.orderId)}
                className="text-link underline-offset-2 hover:underline"
              >
                {shared.orderLink(r.number)}
              </Link>
            ))}
          </p>
        ) : null}
        <ShipmentDetails
          readOnly={host !== null}
          shipment={shipment}
          onChanged={onChanged}
          actions={
            open ? (
              <Button variant="outline" onClick={onRefresh} disabled={busy}>
                <RefreshCw aria-hidden="true" />
                {copy.refresh}
              </Button>
            ) : null
          }
        />
        <div>
          <p className="mb-3 text-eyebrow">{copy.events}</p>
          {events.length === 0 ? (
            <EmptyState variant="inline" body={copy.noEvents} />
          ) : (
            <ol className="relative flex flex-col gap-3 border-border border-l pl-4">
              {shownEvents.map((e) => (
                <li key={`${e.at}-${e.description}`} className="relative text-body">
                  <span
                    className="absolute top-1.5 -left-5 size-2.5 rounded-full border-2 border-background bg-border-strong"
                    aria-hidden="true"
                  />
                  <p className="text-ink-strong">
                    {copy.status[e.status] ?? e.status}
                    {e.location ? (
                      <span className="text-muted-foreground">, {e.location}</span>
                    ) : null}
                  </p>
                  <p className="text-caption font-normal text-muted-foreground">
                    <RelativeTime value={e.at} />
                    {e.description ? `: ${e.description}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          )}
          {events.length > SCANS_SHOWN ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={handleToggleScans}
              aria-expanded={allScans}
            >
              {allScans ? copy.showFewerScans : copy.showAllScans(events.length)}
            </Button>
          ) : null}
        </div>
      </div>
    </DataCard>
  )
}
