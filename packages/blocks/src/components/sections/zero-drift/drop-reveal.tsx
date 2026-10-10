// Port of sections/drop-reveal.liquid (+ assets/drop-reveal.js): a scroll-scrubbed product reveal, products pulled out of a gift box as the page scrolls.
import type { CSSProperties } from 'react'
import { dropRevealContent as copy, DROP_REVEAL } from '../../../data/zero-drift/drop-reveal'
import type { Image } from '../../../sections/framed'
import { safeHref } from '../../../slot-types'
import type { CardProduct } from '../../../types'
import Picture from '../../picture'
import Price from '../../price'
import DropRevealHost from './drop-reveal-host'

type DropRevealProps = {
  heading: string
  subheading: string
  ctaLabel: string
  ctaLink: string
  collectionHandle: string
  productCount: number
  showRibbon: boolean
  ribbonLabel: string
  markImage: Image
  products: CardProduct[]
}

/**
 * The per-product timeline inputs the CSS multiplies: signed distance from the row centre,
 * its absolute value (depth), the focal "hero" flag, a repeating nudge and paint order.
 */
function itemStyle(index: number, shown: number): CSSProperties {
  const fan = index - (shown - 1) * 0.5
  const isHero = index === Math.floor((shown - 1) / 2)
  // With an even count the hero ties with its neighbour on z; the extra 5 keeps it on top.
  const z = Math.round(Math.abs(fan) * -10 + 40) + (isHero ? 5 : 0)
  return {
    '--i': index,
    '--fan': fan,
    '--afan': Math.abs(fan),
    '--hero': isHero ? 1 : 0,
    '--jit': (index % 3) * 0.03,
    '--z': z,
  } as CSSProperties
}

const RIBBON_PARTS = [
  'drop-reveal__ribbon-band drop-reveal__ribbon-band--v',
  'drop-reveal__ribbon-band drop-reveal__ribbon-band--hl',
  'drop-reveal__ribbon-band drop-reveal__ribbon-band--hr',
  'drop-reveal__ribbon-tail drop-reveal__ribbon-tail--l',
  'drop-reveal__ribbon-tail drop-reveal__ribbon-tail--r',
  'drop-reveal__ribbon-loop drop-reveal__ribbon-loop--l',
  'drop-reveal__ribbon-loop drop-reveal__ribbon-loop--r',
  'drop-reveal__ribbon-knot',
]

export default function DropReveal({
  heading,
  subheading,
  ctaLabel,
  ctaLink,
  collectionHandle,
  productCount,
  showRibbon,
  ribbonLabel,
  markImage,
  products,
}: DropRevealProps) {
  // Early returns
  if (!products?.length) {
    return (
      <div className="drop-reveal__inner page-width">
        <p className="drop-reveal__sub text-body">{copy.emptyText}</p>
      </div>
    )
  }

  // Render logic
  const limit = Math.min(DROP_REVEAL.maxProducts, Math.max(DROP_REVEAL.minProducts, productCount))
  const shown = products.slice(0, limit)
  const ctaHref = safeHref(ctaLink) ?? `/collections/${collectionHandle}`

  return (
    <DropRevealHost count={shown.length}>
      <div className="drop-reveal__track" data-drop-track>
        <div className="drop-reveal__stage" data-drop-stage>
          <div className="drop-reveal__inner page-width">
            <div className="drop-reveal__copy">
              {heading ? <h2 className="drop-reveal__heading h1">{heading}</h2> : null}
              {subheading ? <p className="drop-reveal__sub text-body">{subheading}</p> : null}
            </div>

            <div className="drop-reveal__scene" data-drop-scene>
              <div
                className="drop-reveal__card drop-reveal__card--back"
                aria-hidden="true"
                data-drop-card
              >
                <span className="drop-reveal__ground" />
                <div className="drop-reveal__panel drop-reveal__panel--back">
                  <span className="drop-reveal__cavity" />
                </div>
                <div className="drop-reveal__flap">
                  <span className="drop-reveal__flap-face" />
                  <span className="drop-reveal__flap-lining" />
                </div>
              </div>

              <ul className="drop-reveal__products" data-drop-products>
                {shown.map((product, i) => {
                  const image = product.images[0]
                  return (
                    <li
                      key={product.id}
                      className="drop-reveal__item"
                      style={itemStyle(i, shown.length)}
                      data-drop-item
                    >
                      <a className="drop-reveal__product" href={`/products/${product.handle}`}>
                        <span className="drop-reveal__media">
                          {image?.url ? (
                            <Picture
                              image={image}
                              alt={image.alt ?? product.title}
                              className="drop-reveal__image"
                              width={400}
                              height={400}
                              sizes="(min-width: 990px) 18vw, (min-width: 750px) 30vw, 60vw"
                              loading="eager"
                              fetchPriority="low"
                            />
                          ) : (
                            <span className="drop-reveal__image drop-reveal__image--placeholder" />
                          )}
                        </span>
                        <span className="drop-reveal__meta">
                          <span className="drop-reveal__title">{product.title}</span>
                          <span className="drop-reveal__price">
                            <Price pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} />
                          </span>
                        </span>
                      </a>
                    </li>
                  )
                })}
              </ul>

              {showRibbon && ribbonLabel ? <p className="drop-reveal__tag">{ribbonLabel}</p> : null}

              <div className="drop-reveal__card drop-reveal__card--front" aria-hidden="true">
                <span className="drop-reveal__slot-shadow" />
                <span className="drop-reveal__spill" />
                <div className="drop-reveal__panel drop-reveal__panel--pocket">
                  <span className="drop-reveal__lip" />
                  <span className="drop-reveal__mark">
                    {markImage?.url ? (
                      <Picture
                        image={markImage}
                        alt=""
                        className="drop-reveal__mark-image"
                        width={320}
                        height={120}
                        loading="eager"
                        fetchPriority="low"
                        ariaHidden
                      />
                    ) : null}
                  </span>
                </div>
                {showRibbon ? (
                  <div className="drop-reveal__ribbon">
                    {RIBBON_PARTS.map((part) => (
                      <span key={part} className={part} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {ctaLabel ? (
              <div className="drop-reveal__cta">
                <a href={ctaHref} className="btn btn--primary">
                  {ctaLabel}
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </DropRevealHost>
  )
}
