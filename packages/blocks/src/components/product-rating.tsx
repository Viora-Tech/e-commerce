import { mainProductContent as copy } from '../data/glide/main-product'
import Icon from './icon'

type ProductRatingProps = {
  /** Out of 5; 0 draws nothing (there is no reviews source yet, so the merchant types it). */
  value: number
  count: number
}

const STARS = [1, 2, 3, 4, 5]

// The `rating` block of sections/main-product.liquid. The theme read Judge.me's rating
// metafields and, with none, invited the first review; we have no reviews data source, so
// the stars show only when the merchant gives a figure in the section settings.
export default function ProductRating({ value, count }: ProductRatingProps) {
  // Early returns
  if (value <= 0) return null

  // Render logic
  const filled = Math.round(value)

  return (
    <div className="product-info__rating">
      <span
        className="product-info__rating-stars"
        role="img"
        aria-label={copy.ui.ratingLabel(value.toFixed(1))}
      >
        {STARS.map((n) => (
          <span key={n} className={n > filled ? 'product-info__rating-star--empty' : undefined}>
            <Icon name="star" size={16} />
          </span>
        ))}
      </span>
      {count > 0 ? <span>{copy.ui.reviews(count)}</span> : null}
    </div>
  )
}
