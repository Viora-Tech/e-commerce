import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
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
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
        <CardDescription>{copy.items(checkout.itemCount)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
        <dl className="flex flex-col gap-2 text-body">
          <div className="flex justify-between text-muted-foreground">
            <dt>{copy.subtotal}</dt>
            <dd className="tabular-nums">{fmt.money(checkout.subtotalPaise)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>{copy.shipping}</dt>
            <dd>{copy.shippingValue}</dd>
          </div>
          <div className="flex justify-between text-body-strong text-foreground">
            <dt>{copy.total}</dt>
            <dd className="tabular-nums">{fmt.money(checkout.subtotalPaise)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
