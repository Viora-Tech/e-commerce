'use client'

import { hasFixedPrice, lowestPresentment } from '@commerce/money'
import { priceContent as copy } from '../data/price'
import { useFormatPaise, useFormatSaving, useMarketPricing } from '../money-format'

// Port of snippets/price.liquid, as Figma Store / Price (691:85138): the price (in the sale
// colour when discounted), the MRP struck through and the saving in rupees.
export default function Price({
  pricePaise,
  mrpPaise,
  percentBadge = false,
  variantId,
  variants,
}: {
  /** Null: the merchant listed the item before setting a price (#913). */
  pricePaise: number | null
  mrpPaise: number | null
  /** The product page's "−17%" tag after the saving. */
  percentBadge?: boolean | undefined
  /** The variant priced: a market catalog's fixed price for it wins (Markets › Catalogs). */
  variantId?: string | null | undefined
  /**
   * A card's priced variants when it has several: it reads "From" the lowest as this market
   * shows it (a fixed catalog price, else converted) when their prices differ.
   */
  variants?: readonly { id: string; pricePaise: number }[] | undefined
}) {
  // Hooks
  const formatPaise = useFormatPaise()
  const formatSaving = useFormatSaving()
  const pricing = useMarketPricing()

  // Early returns
  if (pricePaise == null) {
    return (
      <div className="price">
        <span className="price__current">{copy.comingSoon}</span>
      </div>
    )
  }

  // Render logic
  const lowest = variants ? lowestPresentment(variants, pricing) : null
  const shownPaise = lowest?.pricePaise ?? pricePaise
  const shownId = lowest?.id ?? variantId ?? undefined
  const fixed = shownId !== undefined && hasFixedPrice(pricing, shownId)
  // A fixed price is its own: no MRP or saving converted from rupees beside it. The card's MRP
  // is its cheapest rupee price's, so it shows only while that is the price shown.
  const onSale = !fixed && shownPaise === pricePaise && mrpPaise != null && mrpPaise > pricePaise
  const current = formatPaise(shownPaise, shownId)

  return (
    <div className={`price${onSale ? ' price--on-sale' : ''}`}>
      <span className="price__current">{lowest?.varies ? copy.from(current) : current}</span>
      {onSale ? (
        <>
          <span className="price__compare">
            <s>{formatPaise(mrpPaise)}</s>
          </span>
          <span className="price__save">Save {formatSaving(mrpPaise, pricePaise)}</span>
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
