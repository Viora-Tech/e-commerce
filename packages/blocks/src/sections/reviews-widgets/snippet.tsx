import ReviewSnippet from '../../components/reviews/widgets/review-snippet'
import { reviewsWidgetsContent as copy } from '../../data/reviews-widgets'
import { topReview } from '../../reviews-widgets'
import { defaultSectionSettings } from '../../section-settings'
import type { ReviewsWidgetContext } from '../../types'
import type { Frame } from '../framed'
import { productFramed } from '../zero-drift/product-frame'
import { yesNo } from './frame'

export type ReviewSnippetProps = Frame & { showQuote: boolean; quoteLength: number }

const defaults = { showQuote: true, quoteLength: 140 }

const fields = {
  showQuote: { type: 'radio', label: copy.fields.showQuote, options: yesNo },
  quoteLength: { type: 'number', label: copy.fields.quoteLength, min: 60, max: 400 },
}

/** The Reviews app's data for this product, set by the product page (`appBlockContext.reviews`). */
const reviewsOf = (context: Record<string, unknown> | undefined) =>
  context?.reviews as ReviewsWidgetContext | undefined

/**
 * Review snippet: placed under the product's buy box, the average, the number of reviews and a
 * short quote from the best one. Product pages only; nothing until the product has reviews.
 */
export function reviewSnippetSection() {
  return productFramed<ReviewSnippetProps>(
    copy.labels.snippet,
    fields,
    defaults,
    { noProduct: copy.hints.snippetNoProduct, empty: copy.hints.snippetEmpty },
    (p, _product, _id, meta) => {
      const reviews = reviewsOf(meta.appBlockContext)
      if (!reviews || reviews.summary.count === 0) return null
      return (
        <div className="page-width">
          <ReviewSnippet
            summary={reviews.summary}
            review={p.showQuote ? topReview(reviews.reviews) : null}
            clip={Math.max(60, p.quoteLength)}
            href="#reviews"
          />
        </div>
      )
    },
    {
      defaultProps: {
        ...defaults,
        settings: defaultSectionSettings({ padTop: 0, padBottom: 16 }),
      },
    },
  )
}
