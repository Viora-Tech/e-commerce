'use client'

import type { Tracking } from '@commerce/core'
import { PackageCheck, RefreshCw, Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import DataCard from '@/components/layout/data-card'
import RelativeTime from '@/components/layout/relative-time'
import ShipmentDetails from '@/components/shipments/shipment-details'
import { shipmentPanelContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
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

/* Nothing to book once the order is closed or the parcel has arrived. */
const CLOSED: ReadonlySet<string> = new Set(['cancelled', 'completed', 'delivered', 'returned'])

/** The order's consignment: book one, or the booked shipment's details (AWB, payment, package,
 *  pickup, label, Cancel shipment) and the courier's scans. */
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

  // Early returns
  const canBook = !shipment || shipment.status === 'cancelled'
  const bookable = canBook && !CLOSED.has(orderStatus)
  if (!shipment || canBook) {
    return (
      <DataCard title={copy.heading}>
        <div className="flex items-center justify-between gap-4">
          <p className="text-body text-muted-foreground">{copy.none}</p>
          {bookable ? (
            <Button onClick={onBook} disabled={busy}>
              <Truck aria-hidden="true" />
              {busy ? copy.booking : copy.book}
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

  return (
    <DataCard
      tone="muted"
      title={copy.heading}
      icon={<PackageCheck aria-hidden="true" />}
      meta={
        <span>
          {copy.updated} <RelativeTime value={shipment.updatedAt} />
          {tracking?.expectedDate ? `, ${copy.expected} ${tracking.expectedDate}` : ''}
        </span>
      }
    >
      <div className="flex flex-col gap-5">
        <ShipmentDetails
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
            <p className="text-body text-muted-foreground">{copy.noEvents}</p>
          ) : (
            <ol className="relative flex flex-col gap-3 border-border border-l pl-4">
              {events.map((e) => (
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
        </div>
      </div>
    </DataCard>
  )
}
