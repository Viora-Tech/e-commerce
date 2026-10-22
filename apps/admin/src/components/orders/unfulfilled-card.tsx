import { PackageCheck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { orderDetailContent } from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'
import { type OrderDetail, unfulfilledLines } from './order-detail-types'
import OrderLinesTable from './order-lines-table'

type UnfulfilledCardProps = {
  order: OrderDetail
  onFulfil: () => void
}

/** What is still waiting to be packed, with the action that packs it. */
export default function UnfulfilledCard({ order, onFulfil }: UnfulfilledCardProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)

  // Render logic
  const rows = unfulfilledLines(order)
  const count = rows.reduce((n, r) => n + r.remaining, 0)

  // Early returns
  if (rows.length === 0 || order.status === 'cancelled') return null

  return (
    <DataCard
      flush
      title={copy.unfulfilled.heading}
      icon={<StatusChip tone="attention">{copy.unfulfilled.itemsCount(count)}</StatusChip>}
      action={
        <Button variant="ghost" size="sm" onClick={onFulfil}>
          <PackageCheck aria-hidden="true" />
          {copy.actions.fulfilItems}
        </Button>
      }
    >
      <OrderLinesTable rows={rows.map(({ line, remaining }) => ({ line, quantity: remaining }))} />
    </DataCard>
  )
}
