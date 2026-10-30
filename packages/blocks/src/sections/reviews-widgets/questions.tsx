import ProductQuestions from '../../components/reviews/widgets/product-questions'
import { reviewsWidgetsContent as copy } from '../../data/reviews-widgets'
import { defaultSectionSettings } from '../../section-settings'
import type { ReviewsWidgetContext } from '../../types'
import type { Frame } from '../framed'
import { productFramed } from '../zero-drift/product-frame'

export type ProductQuestionsProps = Frame & { heading: string; limit: number }

const defaults = { heading: copy.defaults.questionsHeading, limit: 5 }

const fields = {
  heading: { type: 'text', label: copy.fields.heading },
  limit: { type: 'number', label: copy.fields.questionsLimit, min: 1, max: 20 },
}

/** The Reviews app's data for this product, set by the product page (`appBlockContext.reviews`). */
const reviewsOf = (context: Record<string, unknown> | undefined) =>
  context?.reviews as ReviewsWidgetContext | undefined

/**
 * Questions and answers (Reviews app): shoppers ask on the product page, the store answers in
 * Apps › Reviews › Questions, and answered questions show here. Product pages only; draws
 * nothing while the Reviews app is not installed.
 */
export function productQuestionsSection() {
  return productFramed<ProductQuestionsProps>(
    copy.labels.questions,
    fields,
    defaults,
    { noProduct: copy.hints.questionsNoProduct, empty: copy.hints.notInstalled },
    (p, product, _id, meta) => {
      const reviews = reviewsOf(meta.appBlockContext)
      if (!reviews) return null
      return (
        <div className="page-width">
          <ProductQuestions
            heading={p.heading || copy.defaults.questionsHeading}
            productId={product.id}
            questions={reviews.questions ?? []}
            limit={Math.max(1, p.limit || defaults.limit)}
          />
        </div>
      )
    },
    {
      defaultProps: {
        ...defaults,
        settings: defaultSectionSettings({ padTop: 24, padBottom: 24 }),
      },
    },
  )
}
