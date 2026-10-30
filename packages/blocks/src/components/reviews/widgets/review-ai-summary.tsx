import { reviewsWidgetsContent as copy } from '../../../data/reviews-widgets'
import type { ReviewsWidgetContext } from '../../../types'
import RatingStars from '../../rating-stars'

type ReviewAiSummaryProps = {
  heading: string
  text: string
  summary: ReviewsWidgetContext['summary']
  /** Where the review count links: the product page's reviews section. */
  href: string
}

/**
 * "What customers say": the AI summary of the product's published reviews, the average and a
 * link to the reviews it was written from, marked as an AI summary.
 */
export default function ReviewAiSummary({ heading, text, summary, href }: ReviewAiSummaryProps) {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-m)] bg-surface px-4 py-4 text-left text-ink">
      <h2 className="m-0 text-base font-semibold">{heading}</h2>
      <p className="m-0 text-sm leading-relaxed">{text}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <RatingStars rating={summary.rating} hideValue />
        <a href={href} className="text-muted underline-offset-2 hover:underline">
          {copy.readAll(summary.count)}
        </a>
        <span aria-hidden="true">·</span>
        <span>{copy.aiNote}</span>
      </div>
    </div>
  )
}
