import DataCard from '@/components/layout/data-card'
import KeyValueList, { type KeyValueRow } from '@/components/layout/key-value-list'
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
  const rows: KeyValueRow[] = [
    { label: copy.name, value: meta?.name ?? `#${order.number}` },
    { label: copy.financial, value: copy.status(meta?.financialStatus) },
    { label: copy.fulfillment, value: copy.status(meta?.fulfillmentStatus) },
    { label: copy.payment, value: meta?.paymentMethod, hidden: !meta?.paymentMethod },
    {
      label: copy.cancelled,
      value: meta?.cancelledAt ? fmt.dateTime(meta.cancelledAt) : null,
      hidden: !meta?.cancelledAt,
    },
  ]

  return (
    <DataCard title={copy.title(order.importedFrom)}>
      <p className="text-body text-muted-foreground">{copy.body}</p>
      <KeyValueList rows={rows} variant="grid" className="mt-4" />
    </DataCard>
  )
}
