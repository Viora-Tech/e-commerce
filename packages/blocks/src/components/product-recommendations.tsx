// Port of sections/related-products.liquid, as Figma Section / Related products (705:117300): the
// shared section heading over a 2-up (phone) / 4-up grid of product cards. Related products and
// Recently viewed both draw it.
import type { ReactNode } from 'react'
import type { CardProduct } from '../types'
import ProductCard from './product-card'
import SectionHeading from './section-heading'

type ProductRecommendationsProps = {
  /** In the Customize editor an inline-editable node; on the storefront the saved string. */
  heading: ReactNode
  /** The small line over the heading ("Pairs well with"). */
  kicker?: ReactNode
  products: CardProduct[]
  /**
   * Which recommendation row this is, marked on the section so the storefront can count it for
   * Search & discovery (seen, clicked). Left out for rows that are not recommendations
   * (Recently viewed).
   */
  intent?: 'related' | 'complementary' | undefined
}

export default function ProductRecommendations({
  heading,
  kicker,
  products,
  intent,
}: ProductRecommendationsProps) {
  // Early returns
  if (products.length === 0) return null

  // Render logic
  return (
    <section className="section-frame related-products-frame" data-recommendations={intent}>
      <div className="section-related-products page-width">
        {heading ? <SectionHeading kicker={kicker} heading={heading} /> : null}
        <div className="related-products__grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} quickAdd />
          ))}
        </div>
      </div>
    </section>
  )
}
