import ReviewsCarousel from '../../components/reviews/widgets/reviews-carousel'
import type { WidgetCardStyle } from '../../components/reviews/widgets/widget-review-card'
import { reviewsWidgetsContent as copy } from '../../data/reviews-widgets'
import { parseHandles } from '../../reviews-widgets'
import { defaultSectionSettings } from '../../section-settings'
import type { ReviewsLoader } from '../../types'
import { inlineText } from '../inline-fields'
import { cardStyleField, minRatingField, type ReviewsFrame, reviewsFramed, yesNo } from './frame'

export type ReviewsCarouselProps = ReviewsFrame & {
  kicker: string
  heading: string
  limit: number
  minRating: number
  products: string
  showSummary: boolean
  showProduct: boolean
  showPhotos: boolean
  showDate: boolean
  cardStyle: WidgetCardStyle
  autoplay: boolean
  speed: number
}

const f = copy.fields

const fields = {
  kicker: inlineText(f.kicker),
  heading: inlineText(f.heading),
  limit: { type: 'number', label: f.limit, min: 3, max: 30 },
  minRating: minRatingField,
  products: { type: 'text', label: f.products },
  showSummary: { type: 'radio', label: f.showSummary, options: yesNo },
  showProduct: { type: 'radio', label: f.showProduct, options: yesNo },
  showPhotos: { type: 'radio', label: f.showPhotos, options: yesNo },
  showDate: { type: 'radio', label: f.showDate, options: yesNo },
  cardStyle: cardStyleField,
  autoplay: { type: 'radio', label: f.autoplay, options: yesNo },
  speed: { type: 'number', label: f.speed, min: 3, max: 15 },
}

const defaults: Omit<ReviewsCarouselProps, 'settings' | 'resolved'> = {
  kicker: copy.defaults.carouselKicker,
  heading: copy.defaults.carouselHeading,
  limit: 12,
  minRating: 4,
  products: '',
  showSummary: true,
  showProduct: true,
  showPhotos: true,
  showDate: false,
  cardStyle: 'card',
  autoplay: true,
  speed: 5,
}

/** Reviews carousel: published reviews in a sideways row of cards that can move by itself. */
export function reviewsCarouselSection(loadReviews: ReviewsLoader | undefined) {
  return reviewsFramed<ReviewsCarouselProps>(copy.labels.carousel, fields, defaults, {
    loadReviews,
    query: (p) => ({
      limit: p.limit,
      minRating: p.minRating,
      productHandles: parseHandles(p.products),
    }),
    body: (p, data) => (
      <ReviewsCarousel
        kicker={p.kicker}
        heading={p.heading}
        data={data}
        showSummary={p.showSummary}
        showProduct={p.showProduct}
        showPhotos={p.showPhotos}
        showDate={p.showDate}
        cardStyle={p.cardStyle}
        autoplay={p.autoplay}
        speed={p.speed}
      />
    ),
    defaultProps: {
      ...defaults,
      settings: defaultSectionSettings({ padTop: 56, padBottom: 56 }),
    },
  })
}
