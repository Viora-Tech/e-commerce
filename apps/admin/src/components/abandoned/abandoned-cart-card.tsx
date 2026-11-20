import CountBadge from '@/components/layout/count-badge'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import LineItemRow from '@/components/layout/line-item-row'
import TotalsList from '@/components/layout/totals-list'
import { abandonedDetailContent } from '@/data/abandoned-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { AbandonedCheckout } from './abandoned-detail-types'

type AbandonedCartCardProps = {
  checkout: AbandonedCheckout
}

/**
 * Figma "Abandoned checkout · Polish" › Cart: each line with its variant and SKU, the unit price
 * times quantity, the line total; then subtotal and shipping, and the total under a rule.
 */
export default function AbandonedCartCard({ checkout }: AbandonedCartCardProps) {
  // Hooks
  const content = useCopy(abandonedDetailContent)
  const fmt = useFormat()

  // Render logic
  const copy = content.cart
  const subtitleOf = (line: AbandonedCheckout['lines'][number]) =>
    [
      line.variantTitle && line.variantTitle !== 'Default' ? line.variantTitle : null,
      line.sku ? copy.sku(line.sku) : null,
    ]
      .filter(Boolean)
      .join(' · ') || null

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
          <EmptyState variant="inline" body={copy.empty} />
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {checkout.lines.map((line) => (
              <LineItemRow
                key={line.id}
                imageUrl={line.image}
                title={line.productTitle}
                subtitle={subtitleOf(line)}
                quantity={copy.unitTimes(fmt.money(line.unitPricePaise), line.quantity)}
                amount={fmt.money(line.totalPaise)}
              />
            ))}
          </ul>
        )}
        <div className="border-t border-hairline pt-4">
          <TotalsList
            lines={[
              { label: copy.subtotal, value: fmt.money(checkout.subtotalPaise), quiet: true },
              { label: copy.shipping, value: copy.shippingValue, quiet: true },
              { label: copy.total, value: fmt.money(checkout.subtotalPaise), strong: true },
            ]}
          />
        </div>
      </div>
    </DataCard>
  )
}
