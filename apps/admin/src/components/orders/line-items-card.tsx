import DataCard from '@/components/layout/data-card'
import { orderDetailContent } from '@/data/order-detail'
import { useCopy } from '@/hooks/use-copy'
import FulfilledCard from './fulfilled-card'
import { type OrderDetail, packedQuantity, unfulfilledLines } from './order-detail-types'
import OrderLinesTable from './order-lines-table'

type LineItemsCardProps = {
  order: OrderDetail
  /** False when the Unfulfilled section is not drawn (cancelled or imported orders), so
   *  the lines still waiting show here instead; each line is shown exactly once. */
  unfulfilledShown: boolean
  /** The Fulfilled card's row ⋯ › Mark as unfulfilled (that line only); undefined hides it. */
  onUnfulfilLine?: ((lineId: string) => void) | undefined
  /** The Fulfilled card's "Mark as delivered"; undefined hides it. */
  onDelivered?: (() => void) | undefined
}

/**
 * The lines under the Unfulfilled section, after the Saleor order page: packed lines as the
 * grey Fulfilled card with their shipment, then lines not shown elsewhere. The money is the
 * Payment card's.
 */
export default function LineItemsCard({
  order,
  unfulfilledShown,
  onUnfulfilLine,
  onDelivered,
}: LineItemsCardProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)

  // Render logic
  const packed = order.lines
    .map((line) => ({ line, quantity: packedQuantity(order, line) }))
    .filter((l) => l.quantity > 0)
  const waiting = unfulfilledShown
    ? []
    : unfulfilledLines(order).map(({ line, remaining }) => ({ line, quantity: remaining }))

  return (
    <>
      {packed.length > 0 ? (
        <FulfilledCard
          order={order}
          rows={packed}
          onUnfulfil={onUnfulfilLine}
          onDelivered={onDelivered}
        />
      ) : null}
      {waiting.length > 0 ? (
        <DataCard flush title={copy.items.heading}>
          <OrderLinesTable rows={waiting} />
        </DataCard>
      ) : null}
    </>
  )
}
