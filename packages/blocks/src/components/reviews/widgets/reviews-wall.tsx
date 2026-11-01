'use client'

import { type ReactNode, useState } from 'react'
import { reviewsWidgetsContent as copy } from '../../../data/reviews-widgets'
import { filterReviews, type ReviewFilter, starFilters } from '../../../reviews-widgets'
import type { StoreReviews } from '../../../types'
import SectionHeading from '../../section-heading'
import ReviewsSummary from '../reviews-summary'
import WidgetReviewCard, { type WidgetCardStyle } from './widget-review-card'

type ReviewsWallProps = {
  heading: ReactNode
  data: StoreReviews
  perPage: number
  showBreakdown: boolean
  showFilters: boolean
  showProduct: boolean
  showPhotos: boolean
  showDate: boolean
  cardStyle: WidgetCardStyle
}

const CHIP =
  'inline-flex min-h-9 touch-manipulation items-center rounded-full border! border-solid! px-3.5 text-sm transition-[color,background-color,border-color,scale] duration-(--duration-press) ease-out active:scale-(--motion-press-scale)'

/**
 * Every published review on one page (a "Reviews" page): the average with a bar per star, chips
 * to show one star rating or only reviews with photos, and the reviews a page at a time.
 */
export default function ReviewsWall({
  heading,
  data,
  perPage,
  showBreakdown,
  showFilters,
  showProduct,
  showPhotos,
  showDate,
  cardStyle,
}: ReviewsWallProps) {
  // Hooks
  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [shown, setShown] = useState(perPage)

  // Event handlers
  const handleFilter = (next: ReviewFilter) => {
    setFilter(next)
    setShown(perPage)
  }

  // Render logic
  const { summary, reviews } = data
  const list = filterReviews(reviews, filter)
  const anyPhotos = showPhotos && reviews.some((r) => r.photos.length > 0)
  const chips: { key: ReviewFilter; label: string }[] = [
    { key: 'all', label: copy.filters.all },
    ...starFilters(summary.stars).map((n) => ({ key: n, label: copy.filters.stars(n) })),
    ...(anyPhotos ? [{ key: 'photos' as const, label: copy.filters.photos }] : []),
  ]

  return (
    <div className="page-width flex flex-col gap-8">
      {heading ? <SectionHeading heading={heading} /> : null}
      <div
        className={`grid grid-cols-1 gap-8 ${showBreakdown ? 'md:grid-cols-[18rem_1fr] md:gap-12' : ''}`}
      >
        {showBreakdown ? <ReviewsSummary summary={summary} /> : null}
        <div className="flex min-w-0 flex-col gap-5">
          {showFilters && chips.length > 2 ? (
            <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
              <legend className="sr-only">{copy.filters.label}</legend>
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={filter === c.key}
                  onClick={() => handleFilter(c.key)}
                  className={`${CHIP} ${filter === c.key ? 'border-ink! bg-ink! text-bg!' : 'border-line! bg-surface! text-ink! hover:border-ink!'}`}
                >
                  {c.label}
                </button>
              ))}
            </fieldset>
          ) : null}
          {list.length === 0 ? <p className="m-0 text-muted">{copy.noMatch}</p> : null}
          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
            {list.slice(0, shown).map((r) => (
              <li key={r.id}>
                <WidgetReviewCard
                  review={r}
                  cardStyle={cardStyle}
                  showProduct={showProduct}
                  showPhotos={showPhotos}
                  showDate={showDate}
                  clip={1200}
                />
              </li>
            ))}
          </ul>
          {list.length > 0 ? (
            <div className="flex flex-wrap items-center gap-4">
              {list.length > shown ? (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setShown((n) => n + perPage)}
                >
                  {copy.more}
                </button>
              ) : null}
              <span className="text-sm text-muted" aria-live="polite">
                {copy.showing(Math.min(shown, list.length), list.length)}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
