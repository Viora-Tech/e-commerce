import ReviewAiSummary from '../../components/reviews/widgets/review-ai-summary'
import { reviewsWidgetsContent as copy } from '../../data/reviews-widgets'
import { defaultSectionSettings } from '../../section-settings'
import type { ReviewsWidgetContext } from '../../types'
import type { Frame } from '../framed'
import { productFramed } from '../zero-drift/product-frame'

export type ReviewSummaryProps = Frame & { heading: string }

const defaults = { heading: copy.defaults.summaryHeading }

const fields = {
  heading: { type: 'text', label: copy.fields.heading },
}

/** The Reviews app's data for this product, set by the product page (`appBlockContext.reviews`). */
const reviewsOf = (context: Record<string, unknown> | undefined) =>
  context?.reviews as ReviewsWidgetContext | undefined

/**
 * What customers say: the AI summary of the product's reviews (Reviews settings, "AI review
 * summary"), placed near the product's other review sections. Product pages only; nothing
 * until the product has a summary.
 */
export function reviewSummarySection() {
  return productFramed<ReviewSummaryProps>(
    copy.labels.summary,
    fields,
    defaults,
    { noProduct: copy.hints.summaryNoProduct, empty: copy.hints.summaryEmpty },
    (p, _product, _id, meta) => {
      const reviews = reviewsOf(meta.appBlockContext)
      if (!reviews?.aiSummary) return null
      return (
        <div className="page-width">
          <ReviewAiSummary
            heading={p.heading || copy.defaults.summaryHeading}
            text={reviews.aiSummary}
            summary={reviews.summary}
            href="#reviews"
          />
        </div>
      )
    },
    {
      defaultProps: {
        ...defaults,
        settings: defaultSectionSettings({ padTop: 16, padBottom: 16 }),
      },
    },
  )
}
