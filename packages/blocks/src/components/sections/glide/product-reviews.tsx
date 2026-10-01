// Port of sections/product-reviews.liquid: a quote-marked heading over the reviews panel. No reviews store exists yet, so the panel holds the merchant's empty-state text.
import type { ReactNode } from 'react'
import RichCopy from '../../rich-copy'

type ProductReviewsProps = { heading: ReactNode; text: ReactNode }

export default function ProductReviews({ heading, text }: ProductReviewsProps) {
  return (
    <div className="section-product-reviews" id="reviews">
      {heading ? (
        <header className="section-product-reviews__head">
          <span className="section-product-reviews__mark" aria-hidden="true">
            &ldquo;
          </span>
          <h2 className="section-product-reviews__heading h3">{heading}</h2>
        </header>
      ) : null}
      <div className="section-product-reviews__widget">
        <RichCopy value={text} className="section-product-reviews__empty rte" />
      </div>
    </div>
  )
}
