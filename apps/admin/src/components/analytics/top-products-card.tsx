import type { AnalyticsOverview } from '@commerce/api'
import KitListRow from '@/components/kit/kit-list-row'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import { formatPaiseWhole } from '@/lib/money'

type TopProductsCardProps = { products: AnalyticsOverview['topProducts'] }

/** Best sellers for the range, by revenue. */
export default function TopProductsCard({ products }: TopProductsCardProps) {
  // Hooks
  const copy = useCopy(analyticsContent)

  // Render logic
  const c = copy.topProducts

  return (
    <DataCard title={c.title}>
      {products.length === 0 ? (
        <EmptyState variant="inline" body={c.empty} />
      ) : (
        <ul className="flex flex-col gap-4">
          {products.map((p) => (
            <li key={p.productId}>
              <KitListRow
                href={`/products/${p.productId}`}
                image={p.imageUrl}
                title={p.title}
                meta={`${p.units} ${c.units}`}
                value={formatPaiseWhole(p.revenuePaise)}
              />
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
