import ReviewsPhotoGrid from '../../components/reviews/widgets/reviews-photo-grid'
import { reviewsWidgetsContent as copy } from '../../data/reviews-widgets'
import { parseHandles } from '../../reviews-widgets'
import { defaultSectionSettings } from '../../section-settings'
import type { ReviewsLoader } from '../../types'
import { inlineText } from '../inline-fields'
import { minRatingField, type ReviewsFrame, reviewsFramed, yesNo } from './frame'

export type ReviewPhotosProps = ReviewsFrame & {
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
  limit: { type: 'number', label: f.limit, min: 3, max: 48 },
  minRating: minRatingField,
  products: { type: 'text', label: f.products },
  columns: {
    type: 'select',
    label: f.columns,
    options: [3, 4, 5, 6].map((n) => ({ label: String(n), value: n })),
  },
  showProduct: { type: 'radio', label: f.showProduct, options: yesNo },
}

const defaults: Omit<ReviewPhotosProps, 'settings' | 'resolved'> = {
  kicker: '',
  heading: copy.defaults.photosHeading,
  limit: 12,
  minRating: 1,
  products: '',
  columns: 4,
  showProduct: true,
}

/** Review photos: customers' photos from published reviews in a grid; each opens with its review. */
export function reviewPhotosSection(loadReviews: ReviewsLoader | undefined) {
  return reviewsFramed<ReviewPhotosProps>(copy.labels.photos, fields, defaults, {
    loadReviews,
    query: (p) => ({
      limit: p.limit,
      minRating: p.minRating,
      withPhotos: true,
      productHandles: parseHandles(p.products),
    }),
    body: (p, data) => (
      <ReviewsPhotoGrid
        kicker={p.kicker}
        heading={p.heading}
        reviews={data.reviews}
        columns={p.columns}
        showProduct={p.showProduct}
      />
    ),
    emptyHint: copy.hints.noPhotos,
    defaultProps: {
      ...defaults,
      settings: defaultSectionSettings({ padTop: 56, padBottom: 56 }),
    },
  })
}
