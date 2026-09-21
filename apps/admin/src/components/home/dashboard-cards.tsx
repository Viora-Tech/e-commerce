import { cn } from '@commerce/ui/lib/utils'
import { Package, Search, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { BandHead, DataCard, FilterButton } from '@/components/layout/data-card'
import { StatusPill } from '@/components/layout/status-pill'
import { OrderStatusPill } from '@/components/orders/order-badges'
import { homeContent } from '@/data/home'
import type { OrderStatus } from '@/data/orders'
import { formatPaise } from '@/lib/money'

const dateTime = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

type RecentOrder = {
  id: string
  number: number
  status: OrderStatus
  totalPaise: number
  customerName: string | null
  email: string | null
  placedAt: Date | string
}

/* 5:2038: columns start at x 24 / 147 / 336 / 552 and the amount ends 24px from the edge. */
const TX_ROW = 'grid grid-cols-[123px_189px_216px_175px_minmax(0,1fr)] items-center px-6'

/** Frame 5:2032 "Transaction": 33px header, 41px rows 4px apart, 14px text. */
export function RecentOrdersCard({ orders }: { orders: RecentOrder[] }) {
  const c = homeContent.recentOrders
  return (
    <DataCard
      title={c.title}
      action={<FilterButton items={c.filters} />}
      detailsHref="/orders"
      flush
    >
      <div className={cn(TX_ROW, 'h-[33px] text-[14px] text-muted-foreground')}>
        <span>{c.columns.no}</span>
        <span>{c.columns.order}</span>
        <span>{c.columns.date}</span>
        <span>{c.columns.status}</span>
        <span className="text-right">{c.columns.amount}</span>
      </div>
      {orders.length === 0 ? (
        <p className="px-6 py-6 text-body text-muted-foreground">{c.empty}</p>
      ) : (
        <div className="mt-1 flex flex-col gap-1">
          {orders.map((o, i) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className={cn(
                TX_ROW,
                'h-[41px] text-[14px] text-foreground transition-colors hover:bg-background',
              )}
            >
              <span>{i + 1}.</span>
              <span className="truncate">#{o.number}</span>
              <span>{dateTime.format(new Date(o.placedAt))}</span>
              <OrderStatusPill status={o.status} />
              <span className="text-right tabular-nums">{formatPaise(o.totalPaise)}</span>
            </Link>
          ))}
        </div>
      )}
    </DataCard>
  )
}

type TopProduct = {
  productId: string
  title: string
  imageUrl: string | null
  units: number
  revenuePaise: number
  pricePaise: number
  inStock: boolean
}

/** 5:2171: 46px thumbnail with a 12px radius. */
function Thumb({ url, title }: { url: string | null; title: string }) {
  return url ? (
    // biome-ignore lint/performance/noImgElement: merchant media URLs, no optimisation pipeline yet.
    <img src={url} alt="" className="size-[46px] shrink-0 rounded-xl bg-background object-cover" />
  ) : (
    <span className="flex size-[46px] shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground">
      <Package className="size-5" aria-hidden="true" />
      <span className="sr-only">{title}</span>
    </span>
  )
}

/**
 * Frame 5:2088 "Top Products" (292 x 420, 16px side padding): title with an
 * "All product" link, a search field, then rows of thumb / name / item code /
 * price separated by hairlines.
 */
export function TopProductsCard({ products }: { products: TopProduct[] }) {
  const c = homeContent.topProducts
  return (
    <DataCard
      title={c.title}
      className="px-4"
      action={
        <Link href="/products" className="text-[13px] text-link hover:underline">
          {c.all}
        </Link>
      }
    >
      <label className="-mt-1 flex h-9 items-center gap-2 rounded-lg bg-background px-3 text-[14px] text-muted-foreground">
        <Search className="size-4" aria-hidden="true" />
        <input
          type="search"
          placeholder={c.search}
          className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </label>
      {products.length === 0 ? (
        <p className="pt-4 text-body text-muted-foreground">{c.empty}</p>
      ) : (
        <ul className="mt-1 divide-y divide-border-soft">
          {products.map((p) => (
            <li key={p.productId}>
              <Link
                href={`/products/${p.productId}`}
                className="flex h-[66px] items-center gap-3 transition-colors hover:bg-background"
              >
                <Thumb url={p.imageUrl} title={p.title} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold leading-[18px] text-ink-strong">
                    {p.title}
                  </span>
                  <span className="block text-[12px] leading-4 text-muted-foreground">
                    {c.units(p.units)}
                  </span>
                </span>
                <span className="text-[16px] font-bold tabular-nums text-ink-strong">
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
          <TrendingUp className="size-[18px] text-muted-foreground" aria-hidden="true" />
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
              className={cn(BEST_ROW, 'h-[54px] transition-colors hover:bg-background')}
            >
              <span className="flex min-w-0 items-center gap-1">
                <Thumb url={p.imageUrl} title={p.title} />
                <span className="truncate text-body font-bold text-ink-strong">{p.title}</span>
              </span>
              <span>
                <TrendingUp className="size-[18px] text-success" aria-hidden="true" />
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

type LowStockRow = {
  variantId: string
  productId: string
  title: string
  variantTitle: string
  available: number
}

/**
 * Frame 5:2288 "Add New Product" slot: label, 58px rows of thumb / name /
 * detail with a 62 x 28 green pill on the right, "See more" underneath.
 * Ours lists the variants running out, with Restock as the pill.
 */
export function LowStockCard({ rows, threshold }: { rows: LowStockRow[]; threshold: number }) {
  const c = homeContent.lowStock
  return (
    <DataCard
      title={c.title}
      action={
        <Link href="/products/inventory" className="text-[13px] text-link hover:underline">
          {c.viewAll}
        </Link>
      }
    >
      <p className="-mt-2 text-[14px] text-muted-foreground">{c.subtitle(threshold)}</p>
      {rows.length === 0 ? (
        <p className="pt-4 text-body text-muted-foreground">{c.empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {rows.map((r) => (
            <li
              key={r.variantId}
              className="flex h-[58px] items-center gap-3 rounded-lg border border-border-soft px-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink-strong">
                  {r.title}
                </span>
                <span className="block text-[13px] text-muted-foreground">
                  {r.variantTitle !== 'Default' ? `${r.variantTitle}, ` : ''}
                  {c.left(r.available)}
                </span>
              </span>
              <Link
                href={`/products/${r.productId}`}
                className="inline-flex h-7 items-center rounded-full bg-primary px-3 text-[13px] text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {c.restock}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
