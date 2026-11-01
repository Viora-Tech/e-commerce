import ReviewsWall from '../../components/reviews/widgets/reviews-wall'
import type { WidgetCardStyle } from '../../components/reviews/widgets/widget-review-card'
import { reviewsWidgetsContent as copy } from '../../data/reviews-widgets'
import { parseHandles } from '../../reviews-widgets'
import { defaultSectionSettings } from '../../section-settings'
import type { ReviewsLoader } from '../../types'
import { inlineText } from '../inline-fields'
import { cardStyleField, type ReviewsFrame, reviewsFramed, yesNo } from './frame'

export type AllReviewsProps = ReviewsFrame & {
  heading: string
  products: string
  perPage: number
  showBreakdown: boolean
  showFilters: boolean
  showProduct: boolean
  showPhotos: boolean
  showDate: boolean
  cardStyle: WidgetCardStyle
}

/** The most reviews the page holds; shoppers page through them a few at a time. */
const LOADED = 200

const f = copy.fields

const fields = {
  heading: inlineText(f.heading),
  products: { type: 'text', label: f.products },
  perPage: { type: 'number', label: f.perPage, min: 4, max: 40 },
  showBreakdown: { type: 'radio', label: f.showBreakdown, options: yesNo },
  showFilters: { type: 'radio', label: f.showFilters, options: yesNo },
  showProduct: { type: 'radio', label: f.showProduct, options: yesNo },
  showPhotos: { type: 'radio', label: f.showPhotos, options: yesNo },
  showDate: { type: 'radio', label: f.showDate, options: yesNo },
  cardStyle: cardStyleField,
}

const defaults: Omit<AllReviewsProps, 'settings' | 'resolved'> = {
  heading: copy.defaults.allHeading,
  products: '',
  perPage: 10,
  showBreakdown: true,
  showFilters: true,
  showProduct: true,
  showPhotos: true,
  showDate: true,
  cardStyle: 'outline',
}

/**
 * All reviews: every published review on one page (add it to a page such as /pages/reviews),
 * with the rating breakdown and filters by stars and photos.
 */
export function allReviewsSection(loadReviews: ReviewsLoader | undefined) {
  return reviewsFramed<AllReviewsProps>(copy.labels.all, fields, defaults, {
    loadReviews,
    query: (p) => ({ limit: LOADED, productHandles: parseHandles(p.products) }),
    body: (p, data) => (
      <ReviewsWall
        heading={p.heading}
        data={data}
        perPage={Math.max(1, p.perPage)}
        showBreakdown={p.showBreakdown}
        showFilters={p.showFilters}
        showProduct={p.showProduct}
        showPhotos={p.showPhotos}
        showDate={p.showDate}
        cardStyle={p.cardStyle}
      />
    ),
    defaultProps: {
      ...defaults,
      settings: defaultSectionSettings({ padTop: 56, padBottom: 56 }),
    },
  })
}
