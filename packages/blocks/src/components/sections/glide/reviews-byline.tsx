import { reviewsContent as copy } from '../../../data/glide/reviews'
import type { CardProduct } from '../../../types'
import Icon from '../../icon'
import Picture from '../../picture'

type ReviewsBylineProps = {
  /** What to draw: the verified/date meta line, or the reviewed product's chip. */
  part: 'meta' | 'product'
  verified?: boolean | undefined
  date?: string | undefined
  product?: CardProduct | null | undefined
  /** The spotlight wears the chip as a compact tag on its byline row. */
  lead?: boolean | undefined
}

// The two attribution pieces sections/reviews.liquid repeats on the spotlight and on every card:
// "Verified buyer" and the date, and a link to the product the review is about.
export default function ReviewsByline({ part, verified, date, product, lead }: ReviewsBylineProps) {
  // Render logic
  const thumb = product?.images.find((i) => i.url)

  return part === 'meta' ? (
    verified || date ? (
      <span className="review-card__meta text-caption">
        {verified ? (
          <span className="review-card__verified">
            <Icon name="guaranteed" size={13} />
            {copy.verifiedBuyer}
          </span>
        ) : null}
        {date ? <span className="review-card__date">{date}</span> : null}
      </span>
    ) : null
  ) : product ? (
    <a
      className={`review-card__product${lead ? ' reviews__lead-product' : ''}`}
      href={`/products/${product.handle}`}
    >
      <span className="visually-hidden">{copy.productReviewed}</span>
      {thumb ? (
        <Picture
          image={thumb}
          alt=""
          className="review-card__product-image"
          width={44}
          height={44}
          placeholder={false}
          loading="lazy"
          sizes="44px"
        />
      ) : null}
      <span className="review-card__product-title">{product.title}</span>
    </a>
  ) : null
}
