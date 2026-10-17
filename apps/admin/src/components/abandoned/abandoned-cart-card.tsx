import DataCard from '@/components/layout/data-card'
import TotalsList from '@/components/layout/totals-list'
import ProductThumb from '@/components/products/product-thumb'
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
    <DataCard title={copy.heading} subtitle={copy.items(checkout.itemCount)}>
      <div className="flex flex-col gap-4">
        {checkout.lines.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {checkout.lines.map((line) => (
              <li key={line.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <ProductThumb url={line.image} alt={line.productTitle} className="size-10" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-strong text-foreground">
                    {line.productTitle}
                  </span>
                  {line.variantTitle && line.variantTitle !== 'Default' ? (
                    <span className="block truncate text-caption text-muted-foreground">
                      {line.variantTitle}
                    </span>
                  ) : null}
                </span>
                <span className="text-caption text-muted-foreground tabular-nums">
                  {copy.quantity(line.quantity)}
                </span>
                <span className="w-24 text-end font-medium tabular-nums">
                  {fmt.money(line.totalPaise)}
                </span>
              </li>
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
