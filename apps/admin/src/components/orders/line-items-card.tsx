import { PackageCheck } from '@commerce/ui/icons'
import DataCard from '@/components/layout/data-card'
import TotalsList, { type TotalsLine } from '@/components/layout/totals-list'
import { orderDetailContent } from '@/data/orders'
import type { StatusValue } from '@/data/status'
import { useCopy, useFormat } from '@/hooks/use-copy'
import OrderChip from './order-chip'
import { type OrderDetail, packedQuantity, unfulfilledLines } from './order-detail-types'
import OrderLinesTable from './order-lines-table'
import { totalRows } from './order-totals'

type LineItemsCardProps = {
  order: OrderDetail
  /** The payment pill for the summary's payment box. */
  payment: StatusValue<'payment'>
  /** False when the Unfulfilled section is not drawn (cancelled or imported orders), so
   *  the lines still waiting show here instead; each line is shown exactly once. */
  unfulfilledShown: boolean
}

/**
 * The rest of the order under the Unfulfilled section, after the Saleor order page: packed
 * lines as a grey "Fulfilled" group, lines not shown elsewhere, then the order summary
 * (totals, the GST split and what was settled).
 */
export default function LineItemsCard({ order, payment, unfulfilledShown }: LineItemsCardProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const fmt = useFormat()

  // Render logic
  const lines: TotalsLine[] = totalRows(order, copy, fmt).map((r) => ({
    label: r.label,
    value: r.value,
    quiet: r.muted,
    strong: r.strong,
  }))
  const packed = order.lines
    .map((line) => ({ line, quantity: packedQuantity(order, line) }))
    .filter((l) => l.quantity > 0)
  const waiting = unfulfilledShown
    ? []
    : unfulfilledLines(order).map(({ line, remaining }) => ({ line, quantity: remaining }))

  return (
    <>
      {packed.length > 0 ? (
        <DataCard
          flush
          tone="muted"
          title={copy.unfulfilled.fulfilled}
          icon={<PackageCheck aria-hidden="true" />}
        >
          <OrderLinesTable rows={packed} />
        </DataCard>
      ) : null}
      {waiting.length > 0 ? (
        <DataCard flush title={copy.items.heading}>
          <OrderLinesTable rows={waiting} />
        </DataCard>
      ) : null}
      {/* Figma "Orders / Order detail" › Payment: the payment pill in the header, what the order
          costs (subtotal, discount, shipping, the GST split), a rule, then what was settled. */}
      <DataCard title={copy.payment.heading} icon={<OrderChip kind="payment" value={payment} />}>
        <TotalsList lines={lines} />
      </DataCard>
    </>
  )
}
