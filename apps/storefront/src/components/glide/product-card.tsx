import type { CardProduct } from '@/lib/catalog'
import { Price } from './price'

// Port of snippets/product-card.liquid. Hover swap only; cursor scrubbing
// (card-scrub.js) comes with the interactive pass.
export function ProductCard({ product, lazy = true }: { product: CardProduct; lazy?: boolean }) {
  const [primary, hover] = product.images
  const soldOut = product.available <= 0
  const lowStock = !soldOut && product.available <= 5

  return (
    <div className="product-card" data-has-hover={hover ? '' : undefined}>
      <a href={`/products/${product.handle}`} className="product-card__link">
        <div className="product-card__media">
          {soldOut ? (
            <span className="badge product-card__badge product-card__badge--quiet">Sold out</span>
          ) : lowStock ? (
            <span className="badge product-card__badge product-card__badge--urgent">Low stock</span>
          ) : null}
          {primary ? (
            <img
              className="product-card__image product-card__image--primary"
              src={primary.url}
              alt={primary.alt ?? product.title}
              width={533}
              height={533}
              loading={lazy ? 'lazy' : 'eager'}
              fetchPriority={lazy ? undefined : 'high'}
              sizes="(min-width: 990px) 25vw, (min-width: 750px) 33vw, 50vw"
            />
          ) : (
            <div className="product-card__image product-card__image--primary product-card__image--placeholder" />
          )}
          {hover ? (
            <img
              className="product-card__image product-card__image--hover"
              src={hover.url}
              alt=""
              width={533}
              height={533}
              loading="lazy"
              aria-hidden="true"
            />
          ) : null}
        </div>
        <div className="product-card__info">
          <h3 className="product-card__title">{product.title}</h3>
          <div
            className={`product-card__price${soldOut ? ' product-card__price--unavailable' : ''}`}
          >
            <Price pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} />
          </div>
        </div>
      </a>
    </div>
  )
}
