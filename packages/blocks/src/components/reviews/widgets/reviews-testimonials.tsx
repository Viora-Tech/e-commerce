import type { ReactNode } from 'react'
import { reviewsWidgetsContent as copy } from '../../../data/reviews-widgets'
import { clipText } from '../../../reviews-widgets'
import type { StoreReviewCard } from '../../../types'
import RatingStars from '../../rating-stars'
import SectionHeading from '../../section-heading'

type ReviewsTestimonialsProps = {
  kicker: ReactNode
  heading: ReactNode
  reviews: StoreReviewCard[]
  columns: number
  showProduct: boolean
}

const COLUMNS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-2 lg:grid-cols-3',
}

/** "Aarav M." → "A": the avatar letter. */
const initial = (name: string) => name.trim().charAt(0).toUpperCase()

/**
 * Published reviews as large quotes: a quote mark, the words, the stars and who said it. One
 * review fills the width; more sit in columns.
 */
export default function ReviewsTestimonials({
  kicker,
  heading,
  reviews,
  columns,
  showProduct,
}: ReviewsTestimonialsProps) {
  // Render logic
  const grid = COLUMNS[Math.min(3, Math.max(1, columns))] ?? COLUMNS[3]
  const single = reviews.length === 1

  return (
    <div className="page-width flex flex-col gap-8">
      {heading || kicker ? <SectionHeading kicker={kicker} heading={heading} /> : null}
      <ul className={`m-0 grid list-none grid-cols-1 gap-x-10 gap-y-12 p-0 ${single ? '' : grid}`}>
        {reviews.map((r) => (
          <li key={r.id}>
            <figure
              className={`m-0 flex flex-col gap-4 text-ink ${single ? 'mx-auto max-w-[45rem] items-center text-center' : 'text-left'}`}
            >
              <span
                className="font-heading text-6xl leading-[0.6] text-muted select-none"
                aria-hidden="true"
              >
                &ldquo;
              </span>
              <blockquote
                className={`m-0 font-heading leading-snug ${single ? 'text-2xl' : 'text-lg'}`}
              >
                {clipText(r.body || r.title, single ? 480 : 300)}
              </blockquote>
              <RatingStars rating={r.rating} hideValue />
              <figcaption className="flex items-center gap-3 text-sm">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface font-semibold"
                  aria-hidden="true"
                >
                  {initial(r.name)}
                </span>
                <span className="flex flex-col text-left">
                  <span className="font-medium">{r.name}</span>
                  {r.verified ? <span className="text-xs text-muted">{copy.verified}</span> : null}
                  {showProduct && r.product ? (
                    <a
                      href={`/products/${r.product.handle}`}
                      className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
                    >
                      {copy.of(r.product.title)}
                    </a>
                  ) : null}
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </div>
  )
}
