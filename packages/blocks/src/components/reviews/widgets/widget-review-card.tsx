import { reviewsWidgetsContent as copy } from '../../../data/reviews-widgets'
import { clipText, reviewDate } from '../../../reviews-widgets'
import type { StoreReviewCard } from '../../../types'
import RatingStars from '../../rating-stars'

export type WidgetCardStyle = 'card' | 'plain' | 'outline'

type WidgetReviewCardProps = {
  review: StoreReviewCard
  cardStyle: WidgetCardStyle
  showProduct: boolean
  showPhotos: boolean
  showDate: boolean
  /** Longest the review text may run before it is cut at a word. */
  clip?: number | undefined
}

const STYLE: Record<WidgetCardStyle, string> = {
  card: 'rounded-[var(--radius-m)] bg-surface p-5',
  outline: 'rounded-[var(--radius-m)] border border-line p-5',
  plain: 'py-2',
}

/** One review in a Reviews section: stars, title, text, who wrote it, the product and a photo. */
export default function WidgetReviewCard({
  review,
  cardStyle,
  showProduct,
  showPhotos,
  showDate,
  clip = 320,
}: WidgetReviewCardProps) {
  // Render logic
  const photo = showPhotos ? review.photos[0] : undefined
  const date = showDate ? reviewDate(review.createdAt) : ''

  return (
    <article className={`flex h-full flex-col gap-3 text-left text-ink ${STYLE[cardStyle]}`}>
      <RatingStars rating={review.rating} hideValue />
      {review.title ? <h3 className="m-0 text-base font-semibold">{review.title}</h3> : null}
      {review.body ? (
        <p className="m-0 text-sm leading-relaxed">{clipText(review.body, clip)}</p>
      ) : null}
      {photo ? (
        <img
          src={photo}
          alt={copy.photoAlt(review.name)}
          loading="lazy"
          decoding="async"
          className="aspect-square w-20 rounded-md object-cover"
        />
      ) : null}
      <footer className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs text-muted">
        <span className="font-medium text-ink">{review.name}</span>
        {review.verified ? (
          <span className="rounded-sm bg-bg px-1.5 py-0.5 font-medium text-ink">
            {copy.verified}
          </span>
        ) : null}
        {date ? <span>{date}</span> : null}
        {showProduct && review.product ? (
          <a
            href={`/products/${review.product.handle}`}
            className="w-full truncate text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            {copy.of(review.product.title)}
          </a>
        ) : null}
      </footer>
    </article>
  )
}
