import { heroCarouselContent as copy } from '../data/glide/hero-carousel'
import { formatPaise } from '../money'
import type { CardProduct } from '../types'
import Icon from './icon'
import Picture from './picture'
import Price from './price'

type HeroChipProps = {
  product: CardProduct
  style: 'card' | 'inline' | 'bar'
  /** The inline lockup sits under the slide's own headline, so it drops the product name. */
  hasHeading: boolean
  lowStockThreshold: number
}

// The shoppable lockup of sections/hero-carousel.liquid: a frosted bar along the foot of a video
// slide, a small product card, or an inline price-and-button under the headline. Blocks get no
// cart or variant data, so the button leads to the product page (the theme posted single-variant
// products straight to /cart/add).
export default function HeroChip({ product, style, hasHeading, lowStockThreshold }: HeroChipProps) {
  // Render logic
  const href = `/products/${product.handle}`
  const soldOut = product.available <= 0
  const lowStock = !soldOut && product.available <= lowStockThreshold
  const hasPrice = product.pricePaise > 0
  const thumb = product.images.find((i) => i.url)
  const tone = soldOut ? 'out' : lowStock ? 'low' : 'in'
  const stockLabel = soldOut ? copy.soldOut : lowStock ? copy.lowStock : copy.inStock
  const inline = style === 'inline'
  const hasLink = !(inline && hasHeading)
  const addClass = `btn btn--primary hero-carousel__chip-add${inline ? '' : ' btn--small'}`

  return style === 'bar' ? (
    <a className="hero-carousel__bar" href={href}>
      {thumb ? (
        <Picture
          image={thumb}
          alt=""
          className="hero-carousel__bar-image"
          width={52}
          height={52}
          placeholder={false}
          loading="lazy"
          sizes="52px"
        />
      ) : null}
      <span className="hero-carousel__bar-text">
        <span className="hero-carousel__bar-title">{product.title}</span>
        <span className="hero-carousel__bar-meta">
          {soldOut ? copy.soldOut : hasPrice ? formatPaise(product.pricePaise) : null}
        </span>
      </span>
      <span className="hero-carousel__bar-cta">
        {copy.barCta}
        <Icon name="arrow" size={14} />
      </span>
    </a>
  ) : (
    <div className={`hero-carousel__chip hero-carousel__chip--${style}`}>
      {hasLink ? (
        <a className="hero-carousel__chip-link" href={href}>
          {thumb && !inline ? (
            <Picture
              image={thumb}
              alt={thumb.alt ?? ''}
              className="hero-carousel__chip-image"
              width={80}
              height={80}
              placeholder={false}
              loading="lazy"
              sizes="80px"
            />
          ) : null}
          <span className="hero-carousel__chip-text">
            {!inline || !hasHeading ? (
              <span className="hero-carousel__chip-title text-small">{product.title}</span>
            ) : null}
            {!inline && hasPrice ? (
              <Price pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} />
            ) : null}
          </span>
        </a>
      ) : null}
      {inline ? null : (
        <span className={`status-chip status-chip--${tone} hero-carousel__chip-stock`}>
          <span className="status-chip__dot" aria-hidden="true" />
          {stockLabel}
        </span>
      )}
      {soldOut ? (
        <button type="button" className={addClass} disabled>
          <span className="btn__label">{copy.soldOut}</span>
        </button>
      ) : (
        <a href={href} className={addClass}>
          {copy.chipCta}
        </a>
      )}
    </div>
  )
}
