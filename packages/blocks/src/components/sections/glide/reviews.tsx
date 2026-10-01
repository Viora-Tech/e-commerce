// Port of sections/reviews.liquid: a spotlight quote (the first complete review) over a row of supporting review cards
import type { ReactNode } from 'react'
import { reviewsContent as copy } from '../../../data/glide/reviews'
import { focalStyle } from '../../../focal-point'
import { safeHref } from '../../../slot-types'
import Picture from '../../picture'
import RatingStars from '../../rating-stars'
import SectionHeading from '../../section-heading'
import ReviewsByline from './reviews-byline'
import type { ReviewEntry } from './reviews-types'

type ReviewsProps = {
  /** The ReactNode props are strings in storage but React nodes while editing on the canvas. */
  kicker: ReactNode
  heading: ReactNode
  bodyLines: number
  /** Typed by the merchant, never computed from the reviews below (a picked few is not an average). */
  aggregateRating: string
  aggregateText: ReactNode
  writeLabel: ReactNode
  writeUrl: string
  reviews: ReviewEntry[]
  /** In the editor an empty section says what it needs instead of vanishing. */
  editing: boolean
}

/** The customer's own line breaks, kept; a node being typed on the canvas stays whole. */
function withBreaks(body: ReactNode): ReactNode {
  if (typeof body !== 'string') return body
  return body.split('\n').flatMap((line, i) =>
    // biome-ignore lint/suspicious/noArrayIndexKey: lines of one quote, re-split on every render.
    i === 0 ? [line] : [<br key={`b${i}`} />, line],
  )
}

function Avatar({
  review,
  size,
  className,
}: {
  review: ReviewEntry
  size: number
  className: string
}) {
  if (!review.photo?.url) return null
  // Decorative: the reviewer's name sits right beside it.
  return (
    <Picture
      image={review.photo}
      alt=""
      className={className}
      style={focalStyle(review.photo.focal)}
      width={size}
      height={size}
      placeholder={false}
      loading="lazy"
      sizes={`${size}px`}
    />
  )
}

export default function Reviews({
  kicker,
  heading,
  bodyLines,
  aggregateRating,
  aggregateText,
  writeLabel,
  writeUrl,
  reviews,
  editing,
}: ReviewsProps) {
  // Early returns
  const complete = reviews.filter((r) => r.name && r.body)
  if (complete.length === 0 && !editing) return null

  // Render logic
  const [lead, ...rest] = complete
  const aggregate = Number.parseFloat(aggregateRating)
  const writeHref = safeHref(writeUrl)

  return (
    <div className="section-reviews">
      <div className="page-width">
        {kicker || heading ? <SectionHeading kicker={kicker} heading={heading} /> : null}

        {complete.length > 0 && (aggregate > 0 || aggregateText) ? (
          <div className="reviews__aggregate">
            <RatingStars rating={aggregate} />
            {aggregateText ? (
              <span className="reviews__aggregate-text text-small">{aggregateText}</span>
            ) : null}
          </div>
        ) : null}

        {lead ? (
          <figure className="reviews__lead">
            <RatingStars rating={lead.rating} />
            <blockquote className="reviews__lead-quote">{withBreaks(lead.body)}</blockquote>
            <figcaption className="reviews__lead-who">
              <Avatar review={lead} size={56} className="reviews__lead-avatar" />
              <span className="reviews__lead-id">
                <span className="reviews__lead-name">{lead.name}</span>
                <ReviewsByline part="meta" verified={lead.verified} date={lead.date} />
              </span>
              <ReviewsByline part="product" product={lead.product} lead />
            </figcaption>
          </figure>
        ) : null}

        {rest.length > 0 ? (
          <ul
            className="reviews__list"
            style={{ '--review-lines': bodyLines } as React.CSSProperties}
          >
            {rest.map((review, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: reviews are an ordered list with no ids; names may repeat.
              <li key={i} className="review-card">
                <RatingStars rating={review.rating} />
                <blockquote className="review-card__body">{withBreaks(review.body)}</blockquote>
                <div className="review-card__head">
                  <Avatar review={review} size={48} className="review-card__avatar" />
                  <div className="review-card__who">
                    <p className="review-card__name">{review.name}</p>
                    <ReviewsByline part="meta" verified={review.verified} date={review.date} />
                  </div>
                </div>
                <ReviewsByline part="product" product={review.product} />
              </li>
            ))}
          </ul>
        ) : null}

        {writeLabel && writeHref ? (
          <div className="reviews__write">
            <a href={writeHref} className="btn btn--secondary">
              {writeLabel}
            </a>
          </div>
        ) : null}

        {complete.length === 0 ? (
          <p className="reviews__editor-note text-small">{copy.editorEmpty}</p>
        ) : null}
      </div>
    </div>
  )
}
