'use client'

import type { Tracking } from '@commerce/core'
import { ExternalLink, PackageCheck, Printer, RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import CopyButton from '@/components/fields/copy-button'
import DataCard from '@/components/layout/data-card'
import RelativeTime from '@/components/layout/relative-time'
import StatusLabel from '@/components/status/status-label'
import { shipmentPanelContent as copy } from '@/data/shipping'
import type { OrderShipment } from './order-detail-types'

type ShipmentPanelProps = {
  /** The order's fulfilment status while open, else its lifecycle (completed, cancelled). */
  orderStatus: string
  shipment: OrderShipment
  busy: boolean
  onBook: () => void
  onRefresh: () => void
  onCancel: () => void
}

/* Nothing to book once the order is closed or the parcel has arrived. */
const CLOSED: ReadonlySet<string> = new Set(['cancelled', 'completed', 'delivered', 'returned'])

/** Book, refresh or cancel the consignment for an order, and show the courier's scans. */
export default function ShipmentPanel({
  orderStatus,
  shipment,
  busy,
  onBook,
  onRefresh,
  onCancel,
}: ShipmentPanelProps) {
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
              {busy ? copy.booking : copy.book}
            </Button>
          ) : null}
        </div>
      </DataCard>
    )
  }

  // Render logic
  const tracking = (shipment?.tracking ?? null) as Tracking | null
  const open = shipment && shipment.status !== 'cancelled' && shipment.status !== 'delivered'
  const events = tracking?.events.slice().reverse() ?? []

  return (
    <DataCard
      tone="muted"
      title={copy.heading}
      icon={<PackageCheck aria-hidden="true" />}
      meta={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            {copy.courier}: <span className="text-foreground">{shipment.provider}</span>
          </span>
          <span aria-hidden="true">|</span>
          <span className="inline-flex items-center gap-1">
            {copy.waybill}: <code className="text-foreground">{shipment.waybill}</code>
            {shipment.waybill ? <CopyButton value={shipment.waybill} what={copy.waybill} /> : null}
          </span>
          <span aria-hidden="true">|</span>
          <span>
            {copy.updated} <RelativeTime value={shipment.updatedAt} />
            {tracking?.expectedDate ? `, ${copy.expected} ${tracking.expectedDate}` : ''}
          </span>
        </span>
      }
      action={
        <>
          <StatusLabel kind="shipment" value={shipment.status} variant="pill" size="sm" />
          {shipment.labelUrl ? (
            <Button
              variant="outline"
              size="icon"
              aria-label={copy.label}
              title={copy.label}
              render={<a href={shipment.labelUrl} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              <Printer aria-hidden="true" />
            </Button>
          ) : null}
          {shipment.trackingUrl ? (
            <Button
              variant="outline"
              size="icon"
              aria-label={copy.track}
              title={copy.track}
              render={<a href={shipment.trackingUrl} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              <ExternalLink aria-hidden="true" />
            </Button>
          ) : null}
          {open ? (
            <>
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={busy}
                className="text-destructive hover:text-destructive"
              >
                {copy.cancel}
              </Button>
              <Button onClick={onRefresh} disabled={busy}>
                <RefreshCw aria-hidden="true" />
                {copy.refresh}
              </Button>
            </>
          ) : null}
        </>
      }
    >
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
                {e.location ? <span className="text-muted-foreground">, {e.location}</span> : null}
              </p>
              <p className="text-caption font-normal text-muted-foreground">
                <RelativeTime value={e.at} />
                {e.description ? `: ${e.description}` : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
    </DataCard>
  )
}
