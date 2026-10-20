import { mainProductContent as copy } from '../data/zero-drift/main-product'
import Icon from './icon'

type ProductRatingProps = {
  /** Out of 5; 0 draws nothing (a product with no reviews shows no stars). */
  value: number
  count: number
}

const STARS = [1, 2, 3, 4, 5]

// The `rating` block of sections/main-product.liquid (snippets/rating-stars): stars, the
// average and the count. On the store the figure is the product's real one (the Reviews
// app, else the rating imported from Shopify); with none there are no stars.
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
      <span className="product-info__rating-value">{value.toFixed(1)}</span>
      {count > 0 ? <span>{copy.ui.reviews(count)}</span> : null}
    </div>
  )
}
