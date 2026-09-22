import KitButton from '@/components/kit/kit-button'
import KitProductRow from '@/components/kit/kit-product-row'
import DataCard from '@/components/layout/data-card'
import { homeContent } from '@/data/home'

type LowStockRow = {
  variantId: string
  productId: string
  title: string
  variantTitle: string
  available: number
  imageUrl?: string | null
}

/**
 * Sheet 14:910 "Add New Product" slot, product half: 14px Neutral/500 label, then rows of
 * 46px thumb / 14px name / 14/700 green figure with a green "Add" pill, split by hairlines,
 * and a centred "See more" link. Ours lists the variants running out; the pill restocks.
 */
export default function LowStockCard({
  rows,
  threshold,
}: {
  rows: LowStockRow[]
  threshold: number
}) {
  // Render logic
  const c = homeContent.lowStock

  return (
    <DataCard
      title={c.title}
      size="kit"
      action={
        <KitButton variant="link" href="/products/inventory">
          {c.viewAll}
        </KitButton>
      }
    >
      <p className="-mt-2 text-kit-link text-muted-foreground">{c.subtitle(threshold)}</p>
      {rows.length === 0 ? (
        <p className="pt-4 text-kit-body text-muted-foreground">{c.empty}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {rows.map((r) => (
            <KitProductRow
              key={r.variantId}
              image={r.imageUrl ?? null}
              title={r.variantTitle !== 'Default' ? `${r.title}, ${r.variantTitle}` : r.title}
              price={c.left(r.available)}
              action={{ label: c.restock, href: `/products/${r.productId}` }}
            />
          ))}
        </div>
      )}
    </DataCard>
  )
}
