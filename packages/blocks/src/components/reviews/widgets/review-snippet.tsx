import { reviewsWidgetsContent as copy } from '../../../data/reviews-widgets'
import { clipText } from '../../../reviews-widgets'
import type { PublicReviewCard, ReviewsWidgetContext } from '../../../types'
import RatingStars from '../../rating-stars'

type ReviewSnippetProps = {
  summary: ReviewsWidgetContext['summary']
  review: PublicReviewCard | null
  /** Longest the quote may run before it is cut at a word. */
  clip: number
  /** Where "Read all reviews" goes: the product page's reviews section. */
  href: string
}

/**
 * Near Add to cart: the product's average, how many reviews, and one short quote from its best
 * review, linking down to the reviews section.
 */
export default function ReviewSnippet({ summary, review, clip, href }: ReviewSnippetProps) {
  return (
    <div className="flex flex-col gap-2 text-left text-ink">
      <a
        href={href}
        className="flex flex-wrap items-center gap-2 text-sm no-underline underline-offset-2 hover:underline"
      >
        <RatingStars rating={summary.rating} hideValue />
        <span className="font-semibold tabular-nums">{summary.rating.toFixed(1)}</span>
        <span className="text-muted">{copy.readAll(summary.count)}</span>
      </a>
      {review ? (
        <figure className="m-0 rounded-[var(--radius-m)] bg-surface px-4 py-3">
          <blockquote className="m-0 text-sm leading-relaxed">
            &ldquo;{clipText(review.body, clip)}&rdquo;
          </blockquote>
          <figcaption className="mt-1 text-xs text-muted">
            {review.name}
            {review.verified ? ` · ${copy.verified}` : ''}
          </figcaption>
        </figure>
      ) : null}
    </div>
  )
}
