import ReviewsTestimonials from '../../components/reviews/widgets/reviews-testimonials'
import { reviewsWidgetsContent as copy } from '../../data/reviews-widgets'
import { parseHandles } from '../../reviews-widgets'
import { defaultSectionSettings } from '../../section-settings'
import type { ReviewsLoader } from '../../types'
import { inlineText } from '../inline-fields'
import { minRatingField, type ReviewsFrame, reviewsFramed, yesNo } from './frame'

export type ReviewsTestimonialsProps = ReviewsFrame & {
  kicker: string
  heading: string
  limit: number
  minRating: number
  products: string
  columns: number
  showProduct: boolean
}

const f = copy.fields

const fields = {
  kicker: inlineText(f.kicker),
  heading: inlineText(f.heading),
  limit: { type: 'number', label: f.limit, min: 1, max: 9 },
  minRating: minRatingField,
  products: { type: 'text', label: f.products },
  columns: { type: 'number', label: f.columns, min: 1, max: 3 },
  showProduct: { type: 'radio', label: f.showProduct, options: yesNo },
}

const defaults: Omit<ReviewsTestimonialsProps, 'settings' | 'resolved'> = {
  kicker: '',
  heading: copy.defaults.testimonialsHeading,
  limit: 3,
  minRating: 5,
  products: '',
  columns: 3,
  showProduct: true,
}

/** Review testimonials: a few published reviews as large quotes, store-wide or for chosen products. */
export function reviewsTestimonialsSection(loadReviews: ReviewsLoader | undefined) {
  return reviewsFramed<ReviewsTestimonialsProps>(copy.labels.testimonials, fields, defaults, {
    loadReviews,
    query: (p) => ({
      limit: p.limit,
      minRating: p.minRating,
      productHandles: parseHandles(p.products),
    }),
    body: (p, data) => (
      <ReviewsTestimonials
        kicker={p.kicker}
        heading={p.heading}
        reviews={data.reviews}
        columns={p.columns}
        showProduct={p.showProduct}
      />
    ),
    defaultProps: {
      ...defaults,
      settings: defaultSectionSettings({ padTop: 64, padBottom: 64 }),
    },
  })
}
