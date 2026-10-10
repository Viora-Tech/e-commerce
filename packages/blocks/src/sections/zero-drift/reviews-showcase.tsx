import type { ComponentConfig } from '@puckeditor/core'
import ReviewsShowcase from '../../components/sections/zero-drift/reviews-showcase'
import type { ShowcaseReview } from '../../components/sections/zero-drift/reviews-showcase-card'
import { reviewsShowcaseContent as copy } from '../../data/zero-drift/reviews-showcase'
import { defaultSectionSettings } from '../../section-settings'
import { type Frame, framed, imageField, type Link, linkField, noImage } from '../framed'
import { inlineText } from '../inline-fields'
import type { ZeroDriftLoaders } from './loaders'

export type ReviewsShowcaseProps = Frame & {
  eyebrow: string
  rating: number
  reviewCount: number
  verifiedCount: number
  summaryBefore: string
  summaryAfter: string
  reviews: ShowcaseReview[]
  speed: number
  showProduct: boolean
  showPhotos: boolean
  allButton: Link
  writeButton: Link
  browserLabel: string
}

const yesNo = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
]

const fields = {
  eyebrow: inlineText('Small line above the score'),
  rating: { type: 'number', label: 'Average rating (out of 5)', min: 0, max: 5, step: 0.1 },
  reviewCount: { type: 'number', label: 'Total number of reviews', min: 0 },
  verifiedCount: {
    type: 'number',
    label: 'Verified buyers (0 hides the line)',
    min: 0,
  },
  summaryBefore: inlineText('Text before the number of reviews'),
  summaryAfter: inlineText('Text after the number of reviews'),
  allButton: linkField('First button'),
  writeButton: linkField('Write a review button (leave the link empty to hide)'),
  showProduct: { type: 'radio', label: 'Show the product on each card', options: yesNo },
  showPhotos: { type: 'radio', label: 'Show customer photos (slideshow)', options: yesNo },
  browserLabel: { type: 'text', label: 'Address shown in the photo window' },
  speed: { type: 'number', label: 'Seconds per loop (higher is slower)', min: 30, max: 120 },
  reviews: {
    type: 'array',
    label: 'Reviews',
    getItemSummary: (r: { name?: string }) => r.name || 'Review',
    arrayFields: {
      title: inlineText('Headline'),
      quote: { type: 'textarea', label: 'Review' },
      name: { type: 'text', label: 'Name' },
      rating: { type: 'number', label: 'Stars (1 to 5)', min: 1, max: 5 },
      verified: { type: 'radio', label: 'Verified buyer', options: yesNo },
      productName: { type: 'text', label: 'Product name' },
      productHref: { type: 'text', label: 'Product link' },
      photo: imageField('Customer photo'),
    },
  },
}

const defaults: Omit<ReviewsShowcaseProps, keyof Frame> = {
  eyebrow: copy.eyebrow,
  rating: copy.rating,
  reviewCount: copy.reviewCount,
  verifiedCount: copy.verifiedCount,
  summaryBefore: copy.summaryBefore,
  summaryAfter: copy.summaryAfter,
  reviews: copy.reviews.map((r) => ({ ...r, photo: noImage })),
  speed: copy.speed,
  showProduct: true,
  showPhotos: true,
  allButton: { ...copy.allButton },
  writeButton: { ...copy.writeButton },
  browserLabel: copy.browserLabel,
}

// Port of sections/reviews-showcase.liquid. There is no reviews data source yet, so the
// reviews are entered here (the theme read them from Judge.me).
export function reviewsShowcaseSection(_loaders?: ZeroDriftLoaders): ComponentConfig {
  return framed<ReviewsShowcaseProps>(
    'Reviews showcase',
    fields,
    defaults,
    (p) => (
      <ReviewsShowcase
        eyebrow={p.eyebrow}
        rating={p.rating}
        reviewCount={p.reviewCount}
        verifiedCount={p.verifiedCount}
        summaryBefore={p.summaryBefore}
        summaryAfter={p.summaryAfter}
        reviews={p.reviews ?? []}
        speed={p.speed}
        showProduct={p.showProduct}
        showPhotos={p.showPhotos}
        allButton={p.allButton}
        writeButton={p.writeButton}
        browserLabel={p.browserLabel}
      />
    ),
    {
      defaultProps: {
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 64, padBottom: 64 }),
        ...defaults,
      },
    },
  )
}
