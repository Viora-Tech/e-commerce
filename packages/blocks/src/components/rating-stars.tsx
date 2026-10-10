import { reviewsContent as copy } from '../data/zero-drift/reviews'
import Icon from './icon'

type RatingStarsProps = {
  /** Out of `max`; anything not above zero renders nothing (a row of zeros reads as disliked). */
  rating: number
  max?: number | undefined
  /** Stars only, without the number after them (a review card, where the stars say it all). */
  hideValue?: boolean | undefined
}

const STAR_SIZE = 16

// Port of snippets/rating-stars.liquid: full, half and empty stars rounded to the nearest half,
// then the number. The row announces as one sentence; the stars themselves are decorative.
export default function RatingStars({ rating, max = 5, hideValue }: RatingStarsProps) {
  // Early returns
  if (!Number.isFinite(rating) || rating <= 0) return null

  // Render logic
  const value = Math.min(rating, max)
  const rounded = Math.round(value * 2) / 2
  const full = Math.floor(rounded)
  const half = rounded > full
  const shown = String(Math.round(value * 10) / 10)
  const label = max === 5 ? copy.ratingLabel(shown) : copy.outOf(shown, max)

  return (
    <div className="rating-stars" role="img" aria-label={label}>
      <span className="rating-stars__icons" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => {
          const kind = i < full ? 'full' : half && i === full ? 'half' : 'empty'
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: star positions never reorder.
              key={i}
              className={`rating-stars__star rating-stars__star--${kind === 'half' ? 'empty' : kind} relative`}
            >
              <Icon name="star" size={STAR_SIZE} />
              {kind === 'half' ? (
                <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden text-[var(--color-brand)]">
                  <Icon name="star" size={STAR_SIZE} />
                </span>
              ) : null}
            </span>
          )
        })}
      </span>
      {hideValue ? null : <span className="rating-stars__value">{shown}</span>}
    </div>
  )
}
