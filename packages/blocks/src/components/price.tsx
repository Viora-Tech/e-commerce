'use client'

import { priceContent as copy } from '../data/price'
import { useFormatPaise } from '../money-format'

// Port of snippets/price.liquid, as Figma Store / Price (691:85138): the price (in the sale
// colour when discounted), the MRP struck through and the saving in rupees.
export default function Price({
  pricePaise,
  mrpPaise,
  percentBadge = false,
}: {
  /** Null: the merchant listed the item before setting a price (#913). */
  pricePaise: number | null
  mrpPaise: number | null
  /** The product page's "−17%" tag after the saving. */
  percentBadge?: boolean | undefined
}) {
  // Hooks
  const formatPaise = useFormatPaise()

  // Early returns
  if (pricePaise == null) {
    return (
      <div className="price">
        <span className="price__current">{copy.comingSoon}</span>
      </div>
    )
  }

  // Render logic
  const onSale = mrpPaise != null && mrpPaise > pricePaise

  return (
    <div className={`price${onSale ? ' price--on-sale' : ''}`}>
      <span className="price__current">{formatPaise(pricePaise)}</span>
      {onSale ? (
        <>
          <span className="price__compare">
            <s>{formatPaise(mrpPaise)}</s>
          </span>
          <span className="price__save">Save {formatPaise(mrpPaise - pricePaise)}</span>
          {percentBadge ? (
            <span className="badge badge--sale price__badge">
              {`−${Math.round((1 - pricePaise / mrpPaise) * 100)}%`}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
