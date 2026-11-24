import { CheckIcon, PackageCheck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import StatusLabel from '@/components/status/status-label'
import { orderStatusCardsContent } from '@/data/order-cards'
import { orderDetailContent } from '@/data/order-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { OrderDetail, OrderLine } from './order-detail-types'
import OrderLinesTable from './order-lines-table'
import StatusCardTitle from './status-card-title'

type FulfilledCardProps = {
  order: OrderDetail
  /** The packed lines, with how many of each went out. */
  rows: { line: OrderLine; quantity: number }[]
  /** Row ⋯ › Mark as unfulfilled (that line only); undefined hides it. */
  onUnfulfil?: ((lineId: string) => void) | undefined
  /** "Mark as delivered" on the title row; undefined when it does not apply or the banner has it. */
  onDelivered?: (() => void) | undefined
}

const SHORT_DATE = { day: 'numeric', month: 'short' } as const

/**
 * Packed lines, after Shopify's Fulfilled card: a status glyph, the item count and the parcel
 * number in the title, then one line on the shipment (shipped date · courier · AWB linked to
 * tracking · status) above the products. An order in several parcels shows each in the
 * Partly shipped card, so the line and number are left out there.
 */
export default function FulfilledCard({ order, rows, onUnfulfil, onDelivered }: FulfilledCardProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const cards = useCopy(orderStatusCardsContent)
  const fmt = useFormat()

  // Render logic
  const live = order.parcels.filter((p) => p.status !== 'cancelled')
  const single = !order.partShipping && live.length <= 1
  const shipment =
    single && order.shipment && order.shipment.status !== 'cancelled' ? order.shipment : null
  const units = rows.reduce((n, r) => n + r.quantity, 0)
  const parcel = single ? cards.parcelNumber(order.number, live[0]?.position ?? 1) : null

  return (
    <DataCard
      flush
      tone="muted"
      title={
        <StatusCardTitle icon={<PackageCheck />} tone="success">
          {copy.unfulfilled.fulfilled}
          <StatusChip tone="neutral">{copy.unfulfilled.itemsCount(units)}</StatusChip>
          {parcel ? (
            <span className="text-body font-normal text-muted-foreground">{parcel}</span>
          ) : null}
        </StatusCardTitle>
      }
      action={
        onDelivered ? (
          <Button variant="outline" size="sm" onClick={onDelivered}>
            <CheckIcon aria-hidden="true" />
            {cards.markDelivered}
          </Button>
        ) : undefined
      }
    >
      {shipment ? (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 border-border border-b px-4 pb-3 text-caption text-muted-foreground">
          <span>{cards.shipped(fmt.pattern(shipment.createdAt, SHORT_DATE))}</span>
          <span aria-hidden="true">·</span>
          <span>{shipment.providerLabel}</span>
          <span aria-hidden="true">·</span>
          {shipment.trackingUrl ? (
            <a
              href={shipment.trackingUrl}
              target="_blank"
              rel="noreferrer"
              title={cards.trackHint}
              className="text-link underline-offset-2 hover:underline"
            >
              {cards.awb(shipment.waybill)}
            </a>
          ) : (
            <span>{cards.awb(shipment.waybill)}</span>
          )}
          <StatusLabel kind="shipment" value={shipment.status} variant="soft" />
        </p>
      ) : null}
      <OrderLinesTable rows={rows} onUnfulfil={onUnfulfil} />
    </DataCard>
  )
}
