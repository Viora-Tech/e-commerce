'use client'

import type { Tracking } from '@commerce/core'
import { ExternalLink, Printer, RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import DataCard from '@/components/layout/data-card'
import StatusLabel from '@/components/status/status-label'
import { shipmentPanelContent as copy } from '@/data/shipping'
import { type OrderShipment, when } from './order-detail-types'

type ShipmentPanelProps = {
  orderStatus: string
  shipment: OrderShipment
  busy: boolean
  onBook: () => void
  onRefresh: () => void
  onCancel: () => void
}

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
  const bookable = canBook && orderStatus !== 'cancelled' && orderStatus !== 'delivered'
  if (!shipment || canBook) {
    return (
      <DataCard size="kit" title={copy.heading}>
        <div className="flex items-center justify-between gap-4">
          <p className="text-kit-cell text-muted-foreground">{copy.none}</p>
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
      size="kit"
      title={copy.heading}
      action={<StatusLabel kind="shipment" value={shipment.status} variant="glyph" />}
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-kit-cell sm:grid-cols-3">
          <div>
            <dt className="text-kit-body text-muted-foreground-soft">{copy.courier}</dt>
            <dd className="font-medium">{shipment.provider}</dd>
          </div>
          <div>
            <dt className="text-kit-body text-muted-foreground-soft">{copy.waybill}</dt>
            <dd className="font-medium">
              <code>{shipment.waybill}</code>
            </dd>
          </div>
          <div>
            <dt className="text-kit-body text-muted-foreground-soft">{copy.updated}</dt>
            <dd className="font-medium">
              {when(shipment.updatedAt)}
              {tracking?.expectedDate ? (
                <span className="block text-kit-body">
                  {copy.expected} {tracking.expectedDate}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          {shipment.labelUrl ? (
            <Button
              variant="outline"
              size="sm"
              render={<a href={shipment.labelUrl} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              <Printer aria-hidden="true" /> {copy.label}
            </Button>
          ) : null}
          {shipment.trackingUrl ? (
            <Button
              variant="outline"
              size="sm"
              render={<a href={shipment.trackingUrl} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              <ExternalLink aria-hidden="true" /> {copy.track}
            </Button>
          ) : null}
          {open ? (
            <>
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={busy}>
                <RefreshCw aria-hidden="true" /> {copy.refresh}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-destructive dark:text-destructive-foreground dark:hover:bg-destructive/90"
                onClick={onCancel}
                disabled={busy}
              >
                {copy.cancel}
              </Button>
            </>
          ) : null}
        </div>

        <section className="border-t border-border pt-4">
          <p className="text-kit-body text-muted-foreground-soft mb-2">{copy.events}</p>
          {events.length === 0 ? (
            <p className="text-kit-cell text-muted-foreground">{copy.noEvents}</p>
          ) : (
            <ol className="relative flex flex-col gap-3 border-l border-border pl-4">
              {events.map((e) => (
                <li key={`${e.at}-${e.description}`} className="relative text-kit-cell">
                  <span
                    className="absolute top-1.5 -left-5 size-2.5 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                  <p className="font-medium">
                    {copy.status[e.status] ?? e.status}
                    {e.location ? (
                      <span className="text-muted-foreground">, {e.location}</span>
                    ) : null}
                  </p>
                  <p className="text-kit-body text-muted-foreground-soft">
                    {when(e.at)}
                    {e.description ? `: ${e.description}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </DataCard>
  )
}
