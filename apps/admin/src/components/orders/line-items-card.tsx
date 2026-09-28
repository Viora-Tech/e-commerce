import { PackageCheck } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import DataCard from '@/components/layout/data-card'
import StatusLabel from '@/components/status/status-label'
import { orderDetailContent } from '@/data/orders'
import type { StatusValue } from '@/data/status'
import { useCopy, useFormat } from '@/hooks/use-copy'
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
          tone="muted"
          title={copy.unfulfilled.fulfilled}
          icon={<PackageCheck aria-hidden="true" />}
        >
          <OrderLinesTable rows={packed} />
        </DataCard>
      ) : null}
      {waiting.length > 0 ? (
        <DataCard title={copy.items.heading}>
          <OrderLinesTable rows={waiting} />
        </DataCard>
      ) : null}
      <DataCard title={copy.items.summary}>
        {/* Saleor's bottom row: what the order costs on the left, what was paid on the right. */}
        <div className="grid gap-4 md:grid-cols-2">
          <SummaryBox rows={charges} />
          <SummaryBox rows={settled} heading={copy.items.paymentSummary} pill={payment} />
        </div>
      </DataCard>
    </>
  )
}

type SummaryBoxProps = {
  rows: TotalRow[]
  heading?: string
  pill?: StatusValue<'payment'>
}

function SummaryBox({ rows, heading, pill }: SummaryBoxProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-card">
      {heading ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-eyebrow">{heading}</p>
          {pill ? <StatusLabel kind="payment" value={pill} variant="pill" size="sm" /> : null}
        </div>
      ) : null}
      <dl className="flex flex-col gap-2 text-body">
        {rows.map((r) => (
          <div
            key={r.label}
            className={cn(
              'flex justify-between gap-4',
              r.strong && 'font-semibold text-ink-strong',
              r.muted && 'text-muted-foreground',
            )}
          >
            <dt>{r.label}</dt>
            <dd className="tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
