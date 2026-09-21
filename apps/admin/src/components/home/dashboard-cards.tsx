import { cn } from '@commerce/ui/lib/utils'
import { Package } from 'lucide-react'
import Link from 'next/link'
import { DataCard, FilterButton } from '@/components/layout/data-card'
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

const ROW = 'grid grid-cols-[2.5rem_1fr_1.4fr_1fr_auto] items-center gap-3 px-5'

/** Kit "Transaction" table: index, order, date, status dot, amount. */
export function RecentOrdersCard({ orders }: { orders: RecentOrder[] }) {
  const c = homeContent.recentOrders
  return (
    <DataCard title={c.title} action={<FilterButton />} detailsHref="/orders" flush>
      <div className={cn(ROW, 'h-9 text-table-head uppercase text-muted-foreground')}>
        <span>{c.columns.no}</span>
        <span>{c.columns.order}</span>
        <span>{c.columns.date}</span>
        <span>{c.columns.status}</span>
        <span className="text-right">{c.columns.amount}</span>
      </div>
      {orders.length === 0 ? (
        <p className="px-5 py-6 text-body text-muted-foreground">{c.empty}</p>
      ) : (
        orders.map((o, i) => (
          <Link
            key={o.id}
            href={`/orders/${o.id}`}
            className={cn(
              ROW,
              'h-[41px] text-body text-foreground transition-colors hover:bg-muted/60',
            )}
          >
            <span className="text-muted-foreground">{i + 1}.</span>
            <span className="truncate">
              <span className="font-bold">#{o.number}</span>
              {o.customerName ? (
                <span className="text-muted-foreground"> · {o.customerName}</span>
              ) : null}
            </span>
            <span className="text-muted-foreground">{dateTime.format(new Date(o.placedAt))}</span>
            <OrderStatusPill status={o.status} />
            <span className="text-right font-bold tabular-nums">{formatPaise(o.totalPaise)}</span>
          </Link>
        ))
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
}

function Thumb({ url, title }: { url: string | null; title: string }) {
  return url ? (
    // biome-ignore lint/performance/noImgElement: merchant media URLs, no optimisation pipeline yet.
    <img
      src={url}
      alt=""
      className="size-[46px] shrink-0 rounded-xl border border-border-soft object-cover"
    />
  ) : (
    <span className="flex size-[46px] shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
      <Package className="size-5" aria-hidden="true" />
      <span className="sr-only">{title}</span>
    </span>
  )
}

/** Kit "Top products": thumb, name, units, revenue. */
export function TopProductsCard({ products }: { products: TopProduct[] }) {
  const c = homeContent.topProducts
  return (
    <DataCard
      title={c.title}
      action={
        <Link href="/products" className="text-[12px] text-link hover:underline">
          {c.all}
        </Link>
      }
    >
      {products.length === 0 ? (
        <p className="text-body text-muted-foreground">{c.empty}</p>
      ) : (
        <ul className="divide-y divide-border-soft">
          {products.map((p) => (
            <li key={p.productId}>
              <Link
                href={`/products/${p.productId}`}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
              >
                <Thumb url={p.imageUrl} title={p.title} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-bold text-ink-strong">
                    {p.title}
                  </span>
                  <span className="block text-[12px] text-muted-foreground">
                    {c.units(p.units)}
                  </span>
                </span>
                <span className="text-body font-bold tabular-nums text-ink-strong">
                  {formatPaise(p.revenuePaise)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
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

/** Replaces the kit's "Sales by country": variants running out, worst first. */
export function LowStockCard({ rows, threshold }: { rows: LowStockRow[]; threshold: number }) {
  const c = homeContent.lowStock
  return (
    <DataCard title={c.title} kebab>
      <p className="-mt-3 mb-3 text-sm text-muted-foreground">{c.subtitle(threshold)}</p>
      {rows.length === 0 ? (
        <p className="text-body text-muted-foreground">{c.empty}</p>
      ) : (
        <ul className="divide-y divide-border-soft">
          {rows.map((r) => (
            <li key={r.variantId} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-bold text-ink-strong">
                  {r.title}
                </span>
                {r.variantTitle !== 'Default' ? (
                  <span className="block text-[12px] text-muted-foreground">{r.variantTitle}</span>
                ) : null}
              </span>
              <StatusPill tone={r.available <= 0 ? 'destructive' : 'warning'}>
                {c.left(r.available)}
              </StatusPill>
              <Link
                href={`/products/${r.productId}`}
                className="text-[12px] font-medium text-link hover:underline"
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
