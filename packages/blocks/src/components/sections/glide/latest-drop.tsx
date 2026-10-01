// Port of sections/latest-drop.liquid (+ countdown.js): single-product spotlight with hover image swap, specs, countdown and CTAs.
// The panel's tilt is Aceternity UI's 3D Card (`effects/card-3d-container.tsx`), not the theme's [data-tilt] script.
import type { ReactNode } from 'react'
import { latestDropContent as copy } from '../../../data/glide/latest-drop'
import Card3dContainer from '../../../effects/card-3d-container'
import { safeHref } from '../../../slot-types'
import type { CardProduct } from '../../../types'
import CountdownTiles from '../../countdown-tiles'
import Picture from '../../picture'
import Price from '../../price'
import RichCopy from '../../rich-copy'

type LatestDropProps = {
  product: CardProduct | null
  /** The ReactNode props are strings in storage but React nodes while editing on the canvas. */
  kicker: ReactNode
  blurb: ReactNode
  ctaLabel: ReactNode
  secondaryLabel: ReactNode
  secondaryHref: string
  deadline: string
  specs: { label: ReactNode; value: ReactNode }[]
}

const COUNTDOWN = {
  root: 'latest-drop__countdown',
  tile: 'latest-drop__countdown-tile',
  value: 'latest-drop__countdown-value',
  label: 'latest-drop__countdown-label',
}

export default function LatestDrop({
  product,
  kicker,
  blurb,
  ctaLabel,
  secondaryLabel,
  secondaryHref,
  deadline,
  specs,
}: LatestDropProps) {
  // Early returns
  if (!product) {
    return (
      <div className="section-latest-drop page-width">
        <p className="latest-drop__empty text-body">{copy.empty}</p>
      </div>
    )
  }

  // Render logic
  const [main, hover] = product.images
  const secondary = safeHref(secondaryHref)
  const shownSpecs = specs.filter((s) => s.label || s.value)

  return (
    <div className="section-latest-drop page-width">
      <div className="latest-drop">
        <Card3dContainer
          containerClassName="latest-drop__media-wrap"
          className="latest-drop__media"
        >
          {main?.url ? (
            <Picture
              image={main}
              alt={main.alt ?? product.title}
              className="latest-drop__image latest-drop__image--primary"
              fill
              placeholder={false}
              loading="lazy"
              sizes="(min-width: 990px) 55vw, 100vw"
            />
          ) : null}
          {hover?.url ? (
            <Picture
              image={hover}
              alt=""
              ariaHidden
              className="latest-drop__image latest-drop__image--hover"
              fill
              placeholder={false}
              loading="lazy"
              sizes="(min-width: 990px) 55vw, 100vw"
            />
          ) : null}
        </Card3dContainer>

        <div className="latest-drop__content">
          {kicker ? <p className="latest-drop__kicker text-caption">{kicker}</p> : null}
          <h2 className="latest-drop__title h2">{product.title}</h2>
          <div className="latest-drop__price">
            <Price pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} />
          </div>
          <RichCopy value={blurb} className="latest-drop__blurb rte text-body" />

          {shownSpecs.length > 0 ? (
            <div className="latest-drop__specs">
              {shownSpecs.map((spec, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: spec chips have no id and keep their order.
                <div key={i} className="latest-drop__spec">
                  <span className="latest-drop__spec-label text-caption">{spec.label}</span>
                  <span className="latest-drop__spec-value">{spec.value}</span>
                </div>
              ))}
            </div>
          ) : null}

          {deadline ? (
            <CountdownTiles deadline={deadline} labels={copy.countdown} classes={COUNTDOWN} />
          ) : null}

          <div className="latest-drop__actions">
            {ctaLabel ? (
              <a href={`/products/${product.handle}`} className="btn btn--primary">
                {ctaLabel}
              </a>
            ) : null}
            {secondary && secondaryLabel ? (
              <a href={secondary} className="latest-drop__secondary-link">
                {secondaryLabel}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
