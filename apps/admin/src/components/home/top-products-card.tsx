import { Search } from '@commerce/ui/icons'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import { homeContent } from '@/data/home'
import { formatPaise } from '@/lib/money'
import HomeProductThumb from './product-thumb'
import type { TopProduct } from './top-product-types'

/**
 * Frame 5:2088 "Top Products" (292 x 420, 16px side padding): title with an
 * "All product" link, a search field, then rows of thumb / name / item code /
 * price separated by hairlines.
 */
export default function TopProductsCard({ products }: { products: TopProduct[] }) {
  const c = homeContent.topProducts
  return (
    <DataCard
      title={c.title}
      className="px-4"
      size="kit"
      action={
        <Link href="/products" className="text-kit-body text-link hover:underline">
          {c.all}
        </Link>
      }
    >
      <label className="-mt-1 flex h-10 items-center gap-2 rounded-lg bg-background px-3 text-kit-body text-muted-foreground">
        <Search className="size-4" aria-hidden="true" />
        <input
          type="search"
          placeholder={c.search}
          className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </label>
      {products.length === 0 ? (
        <p className="pt-4 text-kit-body text-muted-foreground">{c.empty}</p>
      ) : (
        <ul className="mt-1 divide-y divide-border-soft">
          {products.map((p) => (
            <li key={p.productId}>
              <Link
                href={`/products/${p.productId}`}
                className="flex h-[4.125rem] items-center gap-3 rounded-md transition-[background-color,transform] duration-150 ease-out hover:bg-background hover:-translate-y-px motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <HomeProductThumb url={p.imageUrl} title={p.title} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-kit-cell font-semibold text-ink-strong">
                    {p.title}
                  </span>
                  <span className="block text-kit-body text-muted-foreground">
                    {c.units(p.units)}
                  </span>
                </span>
                <span className="text-kit-cell font-bold tabular-nums text-ink-strong">
                  {formatPaise(p.pricePaise)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
