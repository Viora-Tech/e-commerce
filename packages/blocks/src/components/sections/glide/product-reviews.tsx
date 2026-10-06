// Port of sections/product-reviews.liquid: a quote-marked heading over the reviews panel. With the
// Reviews app installed the panel holds its widget (summary, reviews, write a review); without it,
// the merchant's empty-state text.
import type { ReactNode } from 'react'
import type { ReviewsWidgetContext } from '../../../types'
import ReviewsWidget from '../../reviews/reviews-widget'
import RichCopy from '../../rich-copy'

type ProductReviewsProps = {
  heading: ReactNode
  text: ReactNode
  /** Set by the product page when the Reviews app is installed. */
  reviews?: ReviewsWidgetContext | undefined
}

export default function ProductReviews({ heading, text, reviews }: ProductReviewsProps) {
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
        {reviews ? (
          <ReviewsWidget context={reviews} />
        ) : (
          <RichCopy value={text} className="section-product-reviews__empty rte" />
        )}
      </div>
    </div>
  )
}
