import { productCardContent as copy } from '../data/product-card'
import type { CardProduct } from '../types'
import Picture from './picture'
import Price from './price'
import ProductCardQuickAdd from './product-card-quick-add'
import ProductCardWishlist from './product-card-wishlist'

const saleLabel = (percent: number) => `−${percent}%`

/** Whole-percent saving against MRP, or null when the product is not discounted. */
function salePercent(pricePaise: number, mrpPaise: number | null): number | null {
  if (!mrpPaise || mrpPaise <= pricePaise) return null
  return Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100)
}

// Port of snippets/product-card.liquid. Hover swap only; cursor scrubbing
// (card-scrub.js) comes with the interactive pass. The vendor line and sale
// badge always render; the theme's card settings show or hide them in CSS.
export default function ProductCard({
  product,
  lazy = true,
  quickAdd = false,
}: {
  product: CardProduct
  lazy?: boolean
  /** Figma's "Show quick add": a full-width button under the price. */
  quickAdd?: boolean | undefined
}) {
  const [primary, hover] = product.images
  const preorder = product.available <= 0 ? (product.preorder ?? null) : null
  const soldOut = product.available <= 0 && !preorder
  const lowStock = !soldOut && !preorder && product.available <= 5
  const sale = salePercent(product.pricePaise, product.mrpPaise)

  return (
    <div
      className={`product-card${quickAdd ? ' product-card--quick-add' : ''}`}
      data-has-hover={hover ? '' : undefined}
    >
      <a href={`/products/${product.handle}`} className="product-card__link">
        <div className="product-card__media">
          {soldOut ? (
            <span className="badge product-card__badge product-card__badge--quiet">
              {copy.soldOut}
            </span>
          ) : preorder ? (
            <span className="badge product-card__badge product-card__badge--preorder">
              {copy.preorder}
            </span>
          ) : lowStock ? (
            <span className="badge product-card__badge product-card__badge--urgent">Low stock</span>
          ) : sale ? (
            <span className="badge badge--sale product-card__badge product-card__badge--sale">
              {saleLabel(sale)}
            </span>
          ) : null}
          {primary ? (
            <Picture
              image={primary}
              className="product-card__image product-card__image--primary"
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
            <Picture
              image={hover}
              className="product-card__image product-card__image--hover"
              alt=""
              width={533}
              height={533}
              loading="lazy"
              ariaHidden
            />
          ) : null}
        </div>
        <div className="product-card__info">
          {product.vendor ? <p className="product-card__vendor">{product.vendor}</p> : null}
          <h3 className="product-card__title">{product.title}</h3>
          {product.rating && product.rating.count > 0 ? (
            <p className="product-card__rating">
              <span className="visually-hidden">
                {`Rated ${product.rating.average.toFixed(1)} out of 5 from ${product.rating.count} reviews`}
              </span>
              <span aria-hidden>
                ★ {product.rating.average.toFixed(1)}{' '}
                <span className="product-card__rating-count">({product.rating.count})</span>
              </span>
            </p>
          ) : null}
          <div
            className={`product-card__price${soldOut ? ' product-card__price--unavailable' : ''}`}
          >
            <Price pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} />
          </div>
        </div>
      </a>
      <ProductCardWishlist handle={product.handle} title={product.title} />
      {/* Always rendered: the section's own switch or Theme settings → Product cards shows it. */}
      <ProductCardQuickAdd
        handle={product.handle}
        variantId={product.quickAddVariantId}
        soldOut={soldOut}
        preorderLabel={preorder?.buttonLabel ?? null}
      />
    </div>
  )
}
