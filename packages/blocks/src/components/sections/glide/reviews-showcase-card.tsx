// Port of sections/reviews-showcase.liquid (+ the assets it uses): one review card of the wall
import { reviewsShowcaseContent as copy } from '../../../data/glide/reviews-showcase'
import { focalStyle } from '../../../focal-point'
import type { Image } from '../../../sections/framed'
import { safeHref } from '../../../slot-types'
import Icon from '../../icon'
import Picture from '../../picture'

export type ShowcaseReview = {
  title: string
  quote: string
  name: string
  rating: number
  verified: boolean
  productName: string
  productHref: string
  photo?: Image | undefined
}

type ReviewCardProps = {
  review: ShowcaseReview
  index: number
  showProduct: boolean
}

const MAX_WORDS = 42
const MAX_STARS = 5
const HUE_STEP = 47
const HUE_TURN = 360

/** The theme's `truncatewords: 42`: long quotes end in an ellipsis. */
function truncateWords(text: string): string {
  const words = text.trim().split(/\s+/)
  return words.length > MAX_WORDS ? `${words.slice(0, MAX_WORDS).join(' ')}…` : text
}

export default function ReviewCard({ review, index, showProduct }: ReviewCardProps) {
  // Render logic
  const stars = Math.max(0, Math.min(MAX_STARS, Math.round(review.rating)))
  const photo = review.photo?.url ? review.photo : null
  const productHref = safeHref(review.productHref)
  const hue = ((index + 1) * HUE_STEP) % HUE_TURN

  return (
    <article className={`rs-card${photo ? ' rs-card--photo' : ''}`}>
      {photo ? (
        <Picture
          image={photo}
          alt=""
          className="rs-card__photo"
          style={focalStyle(photo.focal)}
          width={340}
          height={200}
          sizes="(min-width: 990px) 15rem, 80vw"
        />
      ) : null}
      <div className="rs-card__stars" role="img" aria-label={copy.ratingLabel(review.rating)}>
        {Array.from({ length: MAX_STARS }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: the five star slots never reorder.
            key={i}
            className={`rs-card__star${i < stars ? '' : ' rs-card__star--empty'}`}
            aria-hidden="true"
          >
            {copy.starGlyph}
          </span>
        ))}
      </div>
      {review.title ? <h3 className="rs-card__title">{review.title}</h3> : null}
      <p className="rs-card__body">{truncateWords(review.quote)}</p>
      <footer className="rs-card__foot">
        <span
          className="rs-card__avatar"
          style={{ '--hue': hue } as React.CSSProperties}
          aria-hidden="true"
        >
          {review.name.charAt(0)}
        </span>
        <span className="rs-card__who">
          <span className="rs-card__name">{review.name}</span>
          {review.verified ? (
            <span className="rs-card__verified">
              <Icon name="check" size={10} />
              {copy.verifiedBuyer}
            </span>
          ) : null}
        </span>
      </footer>
      {showProduct && review.productName ? (
        productHref ? (
          <a className="rs-card__product" href={productHref}>
            <span>{review.productName}</span>
          </a>
        ) : (
          <span className="rs-card__product">
            <span>{review.productName}</span>
          </span>
        )
      ) : null}
    </article>
  )
}
