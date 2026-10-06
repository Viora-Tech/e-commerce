import { reviewsWidgetContent as copy } from '../../data/reviews-widget'
import type { ReviewsWidgetContext } from '../../types'
import RatingStars from '../rating-stars'

type ReviewsSummaryProps = {
  summary: ReviewsWidgetContext['summary']
}

const ROWS = [5, 4, 3, 2, 1]

/** The big average, its stars, "Based on N reviews" and one bar per star. */
export default function ReviewsSummary({ summary }: ReviewsSummaryProps) {
  // Early returns
  if (summary.count === 0) return <p className="m-0 text-muted">{copy.noReviews}</p>

  // Render logic
  const top = Math.max(1, ...summary.stars)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="font-heading text-5xl leading-none font-bold text-ink tabular-nums">
          {summary.rating.toFixed(1)}
        </span>
        <span className="flex flex-col gap-1">
          <RatingStars rating={summary.rating} hideValue />
          <span className="text-sm text-muted">{copy.basedOn(summary.count)}</span>
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {ROWS.map((n) => {
          const count = summary.stars[n - 1] ?? 0
          return (
            <li
              key={n}
              className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2 text-sm text-muted"
              aria-label={copy.starCount(n, count)}
            >
              <span aria-hidden="true">{copy.starsRow(n)}</span>
              <span className="h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-brand"
                  style={{ width: `${(count / top) * 100}%` }}
                />
              </span>
              <span className="text-right tabular-nums" aria-hidden="true">
                {count}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
