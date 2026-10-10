'use client'

import { type ReactNode, useId, useState } from 'react'
import {
  featuredCarouselContent as copy,
  FEATURED_CAROUSEL,
} from '../../../data/zero-drift/featured-carousel'
import { safeHref } from '../../../slot-types'
import type { CardProduct } from '../../../types'
import Icon from '../../icon'
import Picture from '../../picture'
import Price from '../../price'
import RichCopy from '../../rich-copy'

type FeaturedCarouselSlideProps = {
  product: CardProduct
  /** A string in storage but a React node while editing on the canvas. */
  eyebrow: ReactNode
  flip: boolean
  showStamp: boolean
  stampText: string
  showShare: boolean
  showHelp: boolean
  helpHref: string
  /** The site's address, known only in the browser; the share links wait for it. */
  origin: string
  /** A short pitch under the price (the Featured product section's older `text`). */
  text?: ReactNode
  /** Replaces "Shop now" on the buy button. */
  buttonLabel?: ReactNode
}

// Port of snippets/featured-lockup.liquid: one product's pictures (main + thumbnail strip) on one
// side; eyebrow, title, price, a way to the product, share and help links on the other. The
// buy form (variant picker, quantity, Add to cart, dynamic checkout) needs the cart and variant
// data a block does not get, so "Shop now" and "View full details" lead to the product page.
export default function FeaturedCarouselSlide({
  product,
  eyebrow,
  flip,
  showStamp,
  stampText,
  showShare,
  showHelp,
  helpHref,
  origin,
  text,
  buttonLabel,
}: FeaturedCarouselSlideProps) {
  // Hooks
  const [shown, setShown] = useState(0)
  const stampId = `fc-stamp-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  // Render logic
  const images = product.images.filter((i) => i.url).slice(0, FEATURED_CAROUSEL.maxThumbs)
  const main = images[shown] ?? images[0]
  const productPath = `/products/${product.handle}`
  const help = safeHref(helpHref) ?? copy.helpFallback
  const shareUrl = encodeURIComponent(`${origin}${productPath}`)
  const sharing = showShare && origin !== ''

  return (
    <div className={`featured-lockup${flip ? ' featured-lockup--flip' : ''}`}>
      <div className="featured-lockup__media">
        {showStamp ? (
          <svg className="featured-lockup__stamp" viewBox="0 0 120 120" aria-hidden="true">
            <defs>
              <path id={stampId} d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
            </defs>
            <text className="featured-lockup__stamp-text">
              <textPath href={`#${stampId}`}>{stampText}</textPath>
            </text>
            <g transform="translate(60 60)">
              <path
                d="M-7 3h3V-6h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-3l-3 3z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        ) : null}
        <div className="featured-lockup__gallery">
          <div className="featured-lockup__stage">
            {main ? (
              <a href={productPath} className="featured-lockup__stage-link">
                <Picture
                  image={main}
                  alt={main.alt ?? product.title}
                  className="featured-lockup__image"
                  fill
                  placeholder={false}
                  loading="lazy"
                  sizes="(min-width: 990px) 50vw, 100vw"
                />
              </a>
            ) : null}
          </div>
          {images.length > 1 ? (
            <div className="featured-lockup__thumbs">
              {images.map((image, i) => (
                <button
                  key={image.url}
                  type="button"
                  className={`featured-lockup__thumb${i === shown ? ' is-active' : ''}`}
                  aria-label={`${copy.showImage} ${i + 1}`}
                  aria-pressed={i === shown}
                  onClick={() => setShown(i)}
                >
                  <Picture
                    image={image}
                    alt=""
                    fill
                    placeholder={false}
                    loading="lazy"
                    sizes="72px"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="featured-lockup__info">
        {eyebrow ? <p className="featured-lockup__eyebrow text-caption">{eyebrow}</p> : null}
        <h2 className="featured-lockup__title h2">{product.title}</h2>
        <Price pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} />
        <RichCopy value={text} className="featured-lockup__text text-body" />
        <a href={productPath} className="btn btn--primary featured-lockup__buy">
          {buttonLabel || copy.shopNow}
        </a>

        {sharing || showHelp ? (
          <div className="featured-lockup__aside">
            {sharing ? (
              <div className="featured-lockup__share">
                <span className="text-small">{copy.share}</span>
                {copy.shareTargets.map((target) => (
                  <a
                    key={target.label}
                    href={`${target.url}${shareUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-small"
                  >
                    {target.label}
                  </a>
                ))}
              </div>
            ) : null}
            {showHelp ? (
              <a href={help} className="featured-lockup__help text-small">
                {copy.needHelp}
              </a>
            ) : null}
          </div>
        ) : null}

        <a href={productPath} className="featured-lockup__full-link">
          <span>{copy.viewFullDetails}</span>
          <Icon name="arrow" size={16} />
        </a>
      </div>
    </div>
  )
}
