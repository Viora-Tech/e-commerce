import CountBadge from '@/components/layout/count-badge'
import DataCard from '@/components/layout/data-card'
import LineItemRow from '@/components/layout/line-item-row'
import TotalsList from '@/components/layout/totals-list'
import { abandonedDetailContent } from '@/data/abandoned-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { AbandonedCheckout } from './abandoned-detail-types'

type AbandonedCartCardProps = {
  checkout: AbandonedCheckout
}

export default function AbandonedCartCard({ checkout }: AbandonedCartCardProps) {
  // Hooks
  const content = useCopy(abandonedDetailContent)
  const fmt = useFormat()

  // Render logic
  const copy = content.cart
  return (
    <DataCard
      title={
        <>
          {copy.heading}
          <CountBadge n={copy.items(checkout.itemCount)} tone="outline" />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {checkout.lines.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {checkout.lines.map((line) => (
              <LineItemRow
                key={line.id}
                imageUrl={line.image}
                title={line.productTitle}
                subtitle={
                  line.variantTitle && line.variantTitle !== 'Default' ? line.variantTitle : null
                }
                quantity={copy.quantity(line.quantity)}
                amount={fmt.money(line.totalPaise)}
              />
            ))}
          </ul>
        )}
        <TotalsList
          lines={[
            { label: copy.subtotal, value: fmt.money(checkout.subtotalPaise), quiet: true },
            { label: copy.shipping, value: copy.shippingValue, quiet: true },
            { label: copy.total, value: fmt.money(checkout.subtotalPaise), strong: true },
          ]}
        />
      </div>
    </DataCard>
  )
}
