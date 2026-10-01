import ProductReviews from '../../components/sections/glide/product-reviews'
import { productReviewsContent as copy } from '../../data/glide/product-reviews'
import { defaultSectionSettings } from '../../section-settings'
import type { Frame } from '../framed'
import { inlineRichtext, inlineText } from '../inline-fields'
import { productFramed } from './product-frame'

export type ProductReviewsProps = Frame & { heading: string; text: string }

const defaults = { heading: copy.heading, text: copy.text }

export function productReviewsSection() {
  return productFramed<ProductReviewsProps>(
    copy.label,
    { heading: inlineText(copy.fields.heading), text: inlineRichtext(copy.fields.text) },
    defaults,
    copy,
    (p) => <ProductReviews heading={p.heading} text={p.text} />,
    {
      defaultProps: {
        ...defaults,
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 0, padBottom: 0 }),
      },
    },
  )
}
