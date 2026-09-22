import { type CardProduct, ProductCard, SectionHeading } from '@commerce/blocks'

type ProductRowProps = { heading: string; products: CardProduct[] }

/** A heading and a row of product cards, shared by Related products and Recently viewed. */
export default function ProductRow({ heading, products }: ProductRowProps) {
  // Early returns
  if (products.length === 0) return null

  // Render logic
  return (
    <section className="section-frame page-width py-12">
      {heading ? <SectionHeading heading={heading} /> : null}
      <div className="tabbed-products__grid" style={{ '--columns': 4 } as React.CSSProperties}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  )
}
