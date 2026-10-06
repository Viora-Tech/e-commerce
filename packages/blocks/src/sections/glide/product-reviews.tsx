import ProductReviews from '../../components/sections/glide/product-reviews'
import { productReviewsContent as copy } from '../../data/glide/product-reviews'
import { defaultSectionSettings } from '../../section-settings'
import type { ReviewsWidgetContext } from '../../types'
import type { Frame } from '../framed'
import { inlineRichtext, inlineText } from '../inline-fields'
import { productFramed } from './product-frame'

export type ProductReviewsProps = Frame & { heading: string; text: string }

const defaults = { heading: copy.heading, text: copy.text }

/** The Reviews app's widget data, when the product page set it (`appBlockContext.reviews`). */
const reviewsOf = (context: Record<string, unknown> | undefined) =>
  context?.reviews as ReviewsWidgetContext | undefined

export function productReviewsSection() {
  return productFramed<ProductReviewsProps>(
    copy.label,
    { heading: inlineText(copy.fields.heading), text: inlineRichtext(copy.fields.text) },
    defaults,
    copy,
    (p, _product, _id, meta) => (
      <ProductReviews heading={p.heading} text={p.text} reviews={reviewsOf(meta.appBlockContext)} />
    ),
    {
      defaultProps: {
        ...defaults,
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 0, padBottom: 0 }),
      },
    },
  )
}
