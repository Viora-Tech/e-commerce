import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import ProductThumb from '@/components/products/product-thumb'
import { partlyShippedContent } from '@/data/order-cards'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import OrderChip from './order-chip'
import type { OrderDetail } from './order-detail-types'

type PartlyShippedCardProps = {
  order: OrderDetail
  /** Staff may book shipments: the waiting parcel's Create shipment shows. */
  canShip: boolean
}

type Parcel = OrderDetail['parcels'][number]
type Part = NonNullable<OrderDetail['partShipping']>['parcels'][number]

/** "Kurta / M" without the placeholder variant name. */
function lineName(l: Parcel['lines'][number]): string {
  const variant = l.variantTitle?.trim()
  const title = l.title?.trim() || '—'
  return variant && variant !== 'Default' && variant !== 'Default Title'
    ? `${title} / ${variant}`
    : title
}

/**
 * Order · Partly shipped (Figma 918:10852): one block per parcel, with its label (courier, AWB,
 * when it shipped, delivery by) and Track, or To ship with Create shipment; each waiting item
 * says when it arrives; the footer says when the customer was told it ships in parts.
 */
export default function PartlyShippedCard({ order, canShip }: PartlyShippedCardProps) {
  // Hooks
  const copy = useCopy(partlyShippedContent)
  const fmt = useFormat()

  // Helpers
  const short = (day: Date | string) => fmt.pattern(day, { day: 'numeric', month: 'short' })
  const weekday = (day: string) =>
    fmt.pattern(day, { weekday: 'short', day: 'numeric', month: 'short' })

  // Early returns
  const parts = order.partShipping
  if (!parts) return null

  // Render logic
  const live = order.parcels.filter((p) => p.status !== 'cancelled')
  const shipped = parts.parcels.filter((p) => p.shipment).length
  const imageOf = new Map(order.lines.map((l) => [l.id, l.imageUrl]))
  const partOf = new Map(parts.parcels.map((p) => [p.id, p]))
  const title = (
    <span className="flex flex-wrap items-center gap-2">
      {copy.title(order.number)}
      <OrderChip kind="orderPayment" value={order.paymentStatus} />
      {shipped > 0 && shipped < live.length ? (
        <StatusChip tone="info">{copy.chip(shipped, live.length)}</StatusChip>
      ) : null}
    </span>
  )

  return (
    <DataCard title={title} flush>
      <ul className="flex flex-col divide-y divide-hairline border-t border-hairline">
        {live.map((p, i) => (
          <ParcelBlock
            key={p.id}
            n={i + 1}
            of={live.length}
            parcel={p}
            part={partOf.get(p.id)}
            orderId={order.id}
            orderNumber={order.number}
            imageOf={imageOf}
            canShip={canShip}
            copy={copy}
            short={short}
            weekday={weekday}
          />
        ))}
      </ul>
      {parts.customerToldAt ? (
        <p className="border-t border-hairline bg-muted/50 px-5 py-3 text-caption text-muted-foreground">
          {copy.told(short(parts.customerToldAt), live.length)}
        </p>
      ) : null}
    </DataCard>
  )
}

type ParcelBlockProps = {
  n: number
  of: number
  parcel: Parcel
  part: Part | undefined
  orderId: string
  orderNumber: number
  imageOf: Map<string, string | null>
  canShip: boolean
  copy: typeof partlyShippedContent
  short: (day: Date | string) => string
  weekday: (day: string) => string
}

/** One parcel: its status and action, its items with what each waits for, its label line. */
function ParcelBlock({
  n,
  of,
  parcel,
  part,
  orderId,
  orderNumber,
  imageOf,
  canShip,
  copy,
  short,
  weekday,
}: ParcelBlockProps) {
  // Render logic
  const label = part?.shipment ?? null
  const availabilityOf = new Map(part?.lines.map((l) => [l.orderLineId, l.availability]))
  const waits = part?.lines.some((l) => l.availability.preorder || l.availability.restockOn)
  const lines = label ? parcel.lines : parcel.lines.filter((l) => l.quantity > l.fulfilledQuantity)

  return (
    <li className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-semibold text-ink-strong">
          {copy.parcel(n)}
          {label ? (
            <OrderChip kind="shipment" value={label.status} />
          ) : (
            <StatusChip tone="attention">{copy.toShip}</StatusChip>
          )}
        </span>
        {label?.trackingUrl ? (
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<a href={label.trackingUrl} target="_blank" rel="noopener noreferrer" />}
          >
            {copy.track}
          </Button>
        ) : !label && canShip && parcel.status !== 'fulfilled' ? (
          <Button
            size="sm"
            variant="secondary"
            nativeButton={false}
            render={<Link href={routes.orders.ship(orderId, parcel.id)} />}
          >
            {copy.createShipment}
          </Button>
        ) : null}
      </div>
      <ul className="flex flex-col gap-2">
        {lines.map((l) => {
          const a = availabilityOf.get(l.orderLineId)
          const quantity = label ? l.quantity : l.quantity - l.fulfilledQuantity
          const note = a?.preorder
            ? copy.preorder(a.preorder.arrivesOn ? short(a.preorder.arrivesOn) : null)
            : a && a.inStock < quantity
              ? copy.moreInStock(quantity - a.inStock, a.restockOn ? short(a.restockOn) : null)
              : null
          return (
            <li key={l.orderLineId} className="flex items-center gap-3">
              <ProductThumb
                url={imageOf.get(l.orderLineId) ?? null}
                alt={lineName(l)}
                className="size-8"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body text-ink-strong">{lineName(l)}</span>
                {note ? <span className="text-caption text-muted-foreground">{note}</span> : null}
              </span>
              <span className="shrink-0 text-caption tabular-nums text-muted-foreground">
                × {quantity}
              </span>
            </li>
          )
        })}
      </ul>
      {label ? (
        <p className="text-caption text-muted-foreground">
          {copy.label(
            label.serviceLabel || label.providerLabel,
            label.waybill,
            short(label.bookedAt),
            label.deliveryBy ? weekday(label.deliveryBy) : null,
          )}
        </p>
      ) : waits ? (
        <p className="text-caption text-muted-foreground">{copy.readyWhen(orderNumber, n, of)}</p>
      ) : null}
    </li>
  )
}
