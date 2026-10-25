import type { AnalyticsOverview } from '@commerce/api'
import { Card } from '@commerce/ui/shadcn/card'
import KitListRow from '@/components/kit/kit-list-row'
import { analyticsContent as copy } from '@/data/analytics'
import { formatPaise } from '@/lib/money'

type TopProductsCardProps = { products: AnalyticsOverview['topProducts'] }

/** Best sellers for the range, by revenue. */
export default function TopProductsCard({ products }: TopProductsCardProps) {
  // Render logic
  const c = copy.topProducts

  return (
    <Card gap="none" inset={5}>
      <p className="text-kit-title text-foreground">{c.title}</p>
      {products.length === 0 ? (
        <p className="mt-5 text-kit-body text-muted-foreground">{c.empty}</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-4">
          {products.map((p) => (
            <li key={p.productId}>
              <KitListRow
                href={`/products/${p.productId}`}
                image={p.imageUrl}
                title={p.title}
                meta={`${p.units} ${c.units}`}
                value={formatPaise(p.revenuePaise)}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
