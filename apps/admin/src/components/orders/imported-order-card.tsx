import DataCard from '@/components/layout/data-card'
import { importedOrderContent } from '@/data/orders'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { OrderDetail } from './order-detail-types'

type ImportedOrderCardProps = {
  order: OrderDetail
}

/** Says an order came from another platform and is kept as a read-only record. */
export default function ImportedOrderCard({ order }: ImportedOrderCardProps) {
  // Hooks
  const copy = useCopy(importedOrderContent)
  const fmt = useFormat()

  // Early returns
  if (!order.importedFrom) return null

  // Render logic
  const meta = order.importMeta
  const rows: [string, string][] = [
    [copy.name, meta?.name ?? `#${order.number}`],
    [copy.financial, copy.status(meta?.financialStatus)],
    [copy.fulfillment, copy.status(meta?.fulfillmentStatus)],
    ...(meta?.paymentMethod ? [[copy.payment, meta.paymentMethod] as [string, string]] : []),
    ...(meta?.cancelledAt
      ? [[copy.cancelled, fmt.dateTime(meta.cancelledAt)] as [string, string]]
      : []),
  ]

  return (
    <DataCard title={copy.title(order.importedFrom)}>
      <p className="text-body text-muted-foreground">{copy.body}</p>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-body">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-ink-strong">{value}</dd>
          </div>
        ))}
      </dl>
    </DataCard>
  )
}
