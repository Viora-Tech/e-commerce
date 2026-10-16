import { PackageCheck } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import DataCard from '@/components/layout/data-card'
import { orderDetailContent } from '@/data/orders'
import type { StatusValue } from '@/data/status'
import { useCopy, useFormat } from '@/hooks/use-copy'
import OrderChip from './order-chip'
import { type OrderDetail, packedQuantity, unfulfilledLines } from './order-detail-types'
import OrderLinesTable from './order-lines-table'
import { type TotalRow, totalRows } from './order-totals'

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
  const rows = totalRows(order, copy, fmt)
  const charges = rows.filter((r) => !r.settlement)
  const settled = rows.filter((r) => r.settlement)
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
        <SummaryRows rows={charges} />
        {settled.length > 0 ? (
          <div className="-mx-5 mt-3 border-border border-t px-5 pt-3">
            <SummaryRows rows={settled} />
          </div>
        ) : null}
      </DataCard>
    </>
  )
}

type SummaryRowsProps = {
  rows: TotalRow[]
}

/** Figma payment rows: 13px label left, the figure right; the total semibold, notes muted. */
function SummaryRows({ rows }: SummaryRowsProps) {
  return (
    <dl className="flex flex-col gap-2.5 text-[0.8125rem] leading-[1.1875rem]">
      {rows.map((r) => (
        <div
          key={r.label}
          className={cn(
            'flex justify-between gap-4',
            r.strong ? 'text-body font-semibold text-ink-strong' : 'text-foreground',
            r.muted && 'text-muted-foreground',
          )}
        >
          <dt>{r.label}</dt>
          <dd className="tabular-nums">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}
