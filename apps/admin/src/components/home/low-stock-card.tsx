import Link from 'next/link'
import { DataCard } from '@/components/layout/data-card'
import { homeContent } from '@/data/home'

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
        <Link href="/products/inventory" className="text-xs text-link hover:underline">
          {c.viewAll}
        </Link>
      }
    >
      <p className="-mt-2 text-xs text-muted-foreground">{c.subtitle(threshold)}</p>
      {rows.length === 0 ? (
        <p className="pt-4 text-body text-muted-foreground">{c.empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {rows.map((r) => (
            <li
              key={r.variantId}
              className="flex h-14 items-center gap-3 rounded-lg border border-border-soft px-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-ink-strong">
                  {r.title}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {r.variantTitle !== 'Default' ? `${r.variantTitle}, ` : ''}
                  {c.left(r.available)}
                </span>
              </span>
              <Link
                href={`/products/${r.productId}`}
                className="inline-flex h-7 items-center rounded-full bg-primary px-3 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
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
