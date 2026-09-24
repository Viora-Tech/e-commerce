import { PackageCheck } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import DataCard from '@/components/layout/data-card'
import StatusLabel from '@/components/status/status-label'
import { orderDetailContent as copy } from '@/data/orders'
import { type OrderDetail, unfulfilledLines } from './order-detail-types'
import OrderLinesTable from './order-lines-table'
import { totalRows } from './order-totals'

type LineItemsCardProps = {
  order: OrderDetail
  /** False when the Unfulfilled section is not drawn (cancelled or imported orders), so
   *  the lines still waiting show here instead; each line is shown exactly once. */
  unfulfilledShown: boolean
}

/**
 * The rest of the order under the Unfulfilled section, after the Saleor order page: packed
 * lines as a grey "Fulfilled" group, lines not shown elsewhere, then the order summary
 * (totals, the GST split and what was settled).
 */
export default function LineItemsCard({ order, unfulfilledShown }: LineItemsCardProps) {
  // Render logic
  const rows = totalRows(order)
  const firstSettlement = rows.findIndex((r) => r.settlement)
  const packed = order.lines
    .filter((l) => l.fulfilledQuantity > 0)
    .map((line) => ({ line, quantity: line.fulfilledQuantity }))
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
          action={<StatusLabel kind="fulfilment" value="fulfilled" variant="pill" size="sm" />}
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
        <dl className="flex flex-col gap-2 text-body lg:pl-[50%]">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={cn(
                'flex justify-between',
                r.strong && 'font-semibold',
                r.muted && 'text-muted-foreground',
                i === firstSettlement && firstSettlement > 0 && 'mt-2 border-t border-border pt-4',
              )}
            >
              <dt>{r.label}</dt>
              <dd className="tabular-nums">{r.value}</dd>
            </div>
          ))}
        </dl>
      </DataCard>
    </>
  )
}
