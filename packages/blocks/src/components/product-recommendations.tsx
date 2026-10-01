// Port of sections/related-products.liquid: a heading over a 2-up (phone) / 4-up grid of product cards. Related products and Recently viewed both draw it.
import type { ReactNode } from 'react'
import type { CardProduct } from '../types'
import ProductCard from './product-card'

type ProductRecommendationsProps = {
  /** In the Customize editor an inline-editable node; on the storefront the saved string. */
  heading: ReactNode
  products: CardProduct[]
}

export default function ProductRecommendations({ heading, products }: ProductRecommendationsProps) {
  // Early returns
  if (products.length === 0) return null

  // Render logic
  return (
    <section className="section-frame related-products-frame">
      <div className="section-related-products page-width">
        {heading ? <h2 className="section-related-products__heading h3">{heading}</h2> : null}
        <div className="related-products__grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  )
}
