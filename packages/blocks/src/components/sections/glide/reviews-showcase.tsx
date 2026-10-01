// Port of sections/reviews-showcase.liquid: a big score over a moving wall of review cards. The UI-kit
// effects are the originals, not the theme's re-implementations: reviewer avatars are Aceternity UI's
// Animated Tooltip, the photo slideshow sits in Magic UI's Safari, the wall is Magic UI's (3D) Marquee.
import { reviewsShowcaseContent as copy } from '../../../data/glide/reviews-showcase'
import AnimatedTooltip from '../../../effects/animated-tooltip'
import { linkTarget } from '../../../link'
import type { Link } from '../../../sections/framed'
import { safeHref } from '../../../slot-types'
import Icon from '../../icon'
import ReviewsBrowser, { type BrowserSlide } from './reviews-showcase-browser'
import type { ShowcaseReview } from './reviews-showcase-card'
import ReviewsScore from './reviews-showcase-score'
import ReviewsWall from './reviews-showcase-wall'

type ReviewsShowcaseProps = {
  eyebrow: string
  rating: number
  reviewCount: number
  verifiedCount: number
  summaryBefore: string
  summaryAfter: string
  reviews: ShowcaseReview[]
  speed: number
  showProduct: boolean
  showPhotos: boolean
  allButton: Link
  writeButton: Link
  browserLabel: string
}

const MAX_RATING = 5
const AVATARS = 6
const MAX_PHOTOS = 10
const AVATAR_HUE_STEP = 53
const HUE_TURN = 360

function ActionLink({ link, variant }: { link: Link; variant: 'primary' | 'secondary' }) {
  const href = safeHref(link.href)
  if (!link.label || !href) return null
  return (
    <a className={`btn btn--${variant}`} href={href} {...linkTarget(link)}>
      {link.label}
    </a>
  )
}

export default function ReviewsShowcase({
  eyebrow,
  rating,
  reviewCount,
  verifiedCount,
  summaryBefore,
  summaryAfter,
  reviews,
  speed,
  showProduct,
  showPhotos,
  allButton,
  writeButton,
  browserLabel,
}: ReviewsShowcaseProps) {
  // Render logic
  const average = Math.max(0, Math.min(MAX_RATING, Number(rating) || 0))
  const total = Math.max(0, Math.round(Number(reviewCount) || 0))
  const verified = Math.max(0, Math.round(Number(verifiedCount) || 0))
  const starShare = Math.round((average / MAX_RATING) * 1000) / 10
  const avatars = reviews.slice(0, AVATARS)
  const more = total - avatars.length
  const slides: BrowserSlide[] = showPhotos
    ? reviews
        .filter((r) => r.photo?.url)
        .slice(0, MAX_PHOTOS)
        .map((r) => ({
          photo: r.photo as BrowserSlide['photo'],
          name: r.name,
          rating: r.rating,
          productName: r.productName,
          productHref: r.productHref,
        }))
    : []
  const speedSeconds = Number(speed) || copy.speed

  return (
    <div className="reviews-showcase">
      <div className="reviews-showcase__head page-width">
        {eyebrow ? <p className="reviews-showcase__eyebrow">{eyebrow}</p> : null}
        <ReviewsScore rating={average} label={copy.scoreLabel(average.toFixed(1), total)} />
        <div
          className="reviews-showcase__stars"
          style={{ '--fill': `${starShare}%` } as React.CSSProperties}
          aria-hidden="true"
        >
          <span className="reviews-showcase__stars-base">{copy.starGlyph.repeat(MAX_RATING)}</span>
          <span className="reviews-showcase__stars-fill">{copy.starGlyph.repeat(MAX_RATING)}</span>
        </div>
        <p className="reviews-showcase__summary">
          <span>
            {summaryBefore} {total} {summaryAfter}
          </span>
          {verified > 0 ? (
            <span className="reviews-showcase__verified-total">
              <Icon name="check" size={12} />
              {verified} {copy.verifiedSuffix}
            </span>
          ) : null}
        </p>
        {avatars.length > 0 ? (
          <AnimatedTooltip
            className="mt-[0.5rem]"
            items={avatars.map((r, i) => ({
              id: `${i}`,
              name: r.name,
              designation: copy.tipDetail(r.rating, r.productName),
              initials: r.name.charAt(0).toUpperCase(),
              hue: ((i + 1) * AVATAR_HUE_STEP) % HUE_TURN,
            }))}
            more={more > 0 ? copy.more(more) : null}
          />
        ) : null}
        <div className="reviews-showcase__actions">
          <ActionLink link={allButton} variant="secondary" />
          <ActionLink link={writeButton} variant="primary" />
        </div>
      </div>

      <div className={`rs-stage page-width${slides.length > 0 ? '' : ' rs-stage--no-photos'}`}>
        {slides.length > 0 ? <ReviewsBrowser slides={slides} label={browserLabel} /> : null}
        <ReviewsWall
          reviews={reviews}
          showProduct={showProduct}
          layout="columns"
          speedSeconds={speedSeconds}
        />
      </div>

      <ReviewsWall
        reviews={reviews}
        showProduct={showProduct}
        layout="rows"
        speedSeconds={speedSeconds}
      />
    </div>
  )
}
