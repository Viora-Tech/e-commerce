import { cn } from '@commerce/ui/lib/utils'
import { TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { BandHead } from '@/components/layout/band-head'
import { DataCard } from '@/components/layout/data-card'
import { FilterButton } from '@/components/layout/filter-button'
import { StatusPill } from '@/components/layout/status-pill'
import { homeContent } from '@/data/home'
import { formatPaise } from '@/lib/money'
import { HomeProductThumb } from './product-thumb'
import type { TopProduct } from './top-product-types'

/* 5:2146: Product 240 / trend 148 / Total order 152 / Status 152 / Price. */
const BEST_ROW = 'grid grid-cols-[minmax(0,2.4fr)_1fr_1.1fr_1.1fr_1fr] items-center px-5'

/** Frame 5:2138 "Best selling product": tinted 48px header band, 54px rows with thumbnails. */
export function BestSellingCard({ products }: { products: TopProduct[] }) {
  const c = homeContent.bestSelling
  return (
    <DataCard title={c.title} action={<FilterButton items={c.filters} />} detailsHref="/products">
      <BandHead className={BEST_ROW}>
        <span>{c.columns.product}</span>
        <span>
          <TrendingUp className="size-4 text-muted-foreground" aria-hidden="true" />
        </span>
        <span>{c.columns.totalOrder}</span>
        <span>{c.columns.status}</span>
        <span>{c.columns.price}</span>
      </BandHead>
      {products.length === 0 ? (
        <p className="px-5 py-6 text-body text-muted-foreground">{c.empty}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-1">
          {products.map((p) => (
            <Link
              key={p.productId}
              href={`/products/${p.productId}`}
              className={cn(BEST_ROW, 'h-12 transition-colors hover:bg-background')}
            >
              <span className="flex min-w-0 items-center gap-1">
                <HomeProductThumb url={p.imageUrl} title={p.title} />
                <span className="truncate text-body font-bold text-ink-strong">{p.title}</span>
              </span>
              <span>
                <TrendingUp className="size-4 text-success" aria-hidden="true" />
              </span>
              <span className="text-body tabular-nums">{p.units}</span>
              <StatusPill tone={p.inStock ? 'success' : 'destructive'}>
                {p.inStock ? c.inStock : c.outOfStock}
              </StatusPill>
              <span className="text-body font-bold tabular-nums text-ink-strong">
                {formatPaise(p.pricePaise)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </DataCard>
  )
}
