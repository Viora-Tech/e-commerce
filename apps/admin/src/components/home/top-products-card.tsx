import KitButton from '@/components/kit/kit-button'
import KitListRow from '@/components/kit/kit-list-row'
import KitSearch from '@/components/kit/kit-search'
import DataCard from '@/components/layout/data-card'
import { homeContent } from '@/data/home'
import { formatPaise } from '@/lib/money'
import type { TopProduct } from './top-product-types'

/**
 * Sheet 14:860 "Top Products" (292 x 420, 16px left / 20px top inset): 18/700 title with a
 * 12px "All product" link, a 36px search field, then 16px-spaced rows of 56px thumb /
 * 15/500 name / 12px item line / 15/700 price over #d1d1d1 hairlines.
 */
export default function TopProductsCard({ products }: { products: TopProduct[] }) {
  // Render logic
  const c = homeContent.topProducts

  return (
    <DataCard
      title={c.title}
      className="px-4"
      size="kit"
      action={
        <KitButton variant="linkSm" href="/products">
          {c.all}
        </KitButton>
      }
    >
      <KitSearch placeholder={c.search} aria-label={c.search} className="-mt-1 w-full" />
      {products.length === 0 ? (
        <p className="pt-4 text-kit-body text-muted-foreground">{c.empty}</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-4">
          {products.map((p) => (
            <li key={p.productId}>
              <KitListRow
                href={`/products/${p.productId}`}
                image={p.imageUrl}
                title={p.title}
                meta={c.units(p.units)}
                value={formatPaise(p.pricePaise)}
              />
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
