/**
 * Shopify gift card products. Shopify marks them with `isGiftCard` (GraphQL), `gift_card`
 * (REST) or a "Gift Card" CSV column; older exports only say it through the product type
 * ("Gift Card", Shopify's default) or the `gift_card` template. Here the flag is
 * `product.isGiftCard`, and the variants look the way `createGiftCardProduct` makes them:
 * untracked, untaxed at sale, weightless.
 */
import type { NProduct } from './types'

const GIFT_CARD_TYPE = /^gift[\s_-]?cards?$/i
const GIFT_CARD_TEMPLATE = /^gift[_-]?card$/i

/**
 * Whether a product is a gift card. An explicit source flag wins; without one, Shopify's
 * default product type or gift card template says yes, and anything else is unknown
 * (undefined, so a re-import leaves the flag as it is).
 */
export function giftCardFrom(signal: {
  flag?: boolean | null | undefined
  productType?: string | null | undefined
  templateSuffix?: string | null | undefined
}): boolean | undefined {
  if (typeof signal.flag === 'boolean') return signal.flag
  if (GIFT_CARD_TYPE.test((signal.productType ?? '').trim())) return true
  if (GIFT_CARD_TEMPLATE.test((signal.templateSuffix ?? '').trim())) return true
  return undefined
}

/** A gift card's variants: never stocked, taxed or weighed (GST applies when it is redeemed). */
export function asGiftCardVariants(variants: NProduct['variants']): NProduct['variants'] {
  return variants.map((v) => ({
    ...v,
    taxable: false,
    trackInventory: false,
    weightGrams: 0,
    onHand: null,
    sellsOutOfStock: false,
  }))
}
