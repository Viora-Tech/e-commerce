import type { CardProduct } from '@commerce/blocks'
import { ProductCard } from '@commerce/blocks'
import type { CSSProperties } from 'react'
import LiquidHtml from '@/components/theme/liquid-html'
import { collectionsContent as copy } from '@/data/collections'
import type { LiquidCards } from '@/lib/liquid-cards'

type CollectionGridProps = {
  products: CardProduct[]
  /** Products per row on a desktop (MainCollection's setting); 0 or unset keeps the grid's own. */
  columns?: number | undefined
  /** Products per row on a phone; 0 or unset keeps two. */
  columnsMobile?: number | undefined
  /**
   * An imported theme's own card for each product, in the same order (`lib/liquid-cards.ts`).
   * A product without one, or a grid without any, draws our card.
   */
  themeCards?: LiquidCards | null | undefined
}

/** A positive whole number of columns, or null for "the grid's own". */
function perRow(value: number | undefined, max: number): number | null {
  return typeof value === 'number' && value >= 1 ? Math.min(max, Math.round(value)) : null
}

/** Zero Drift's product grid, reused for a collection's page and the Puck block. */
export default function CollectionGrid({
  products,
  columns,
  columnsMobile,
  themeCards,
}: CollectionGridProps) {
  // Early returns
  if (products.length === 0) {
    return <p className="text-body collection__empty">{copy.empty}</p>
  }

  // Render logic
  const desktop = perRow(columns, 6)
  const phone = perRow(columnsMobile, 2)
  const style = {
    ...(desktop ? { '--columns-desktop': desktop } : {}),
    ...(phone ? { '--columns-mobile': phone } : {}),
  } as CSSProperties
  // The theme's cards sit inside Shopify's section class, so our own card styles (which share
  // its class names) stay off them, as on every imported section (theme-css-fence sweep).
  const fence = themeCards ? ' shopify-section' : ''

  return (
    <div
      className={`collection__grid${fence}`}
      data-columns={desktop ?? undefined}
      data-columns-mobile={phone ?? undefined}
      style={style}
    >
      {themeCards?.head ? <LiquidHtml html={themeCards.head} /> : null}
      {products.map((product, i) => {
        const html = themeCards?.cards[i]
        return html ? (
          <LiquidHtml key={product.id} html={html} />
        ) : (
          <ProductCard key={product.id} product={product} lazy={i > 3} />
        )
      })}
    </div>
  )
}
