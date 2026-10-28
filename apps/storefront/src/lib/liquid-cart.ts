import 'server-only'
import {
  type getCart,
  type LiquidCartData,
  type MarketPricing,
  presentmentCents,
} from '@commerce/core'

type CartView = NonNullable<Awaited<ReturnType<typeof getCart>>>

/** A cart in the shape Liquid reads, priced in the page's market; an empty one without a cart. */
export function toLiquidCart(cart: CartView | null, pricing: MarketPricing | null): LiquidCartData {
  if (!cart) return { itemCount: 0, totalPrice: 0, items: [] }
  return {
    itemCount: cart.itemCount,
    totalPrice: presentmentCents(cart.subtotalPaise, pricing),
    items: cart.lines.map((l) => ({
      id: l.variantId,
      quantity: l.quantity,
      title: l.productTitle,
      price: presentmentCents(l.unitPricePaise, pricing),
      linePrice: presentmentCents(l.linePaise, pricing),
      product: null,
      variantTitle: l.variantTitle,
      image: l.imageUrl ? { url: l.imageUrl, alt: l.productTitle } : null,
      url: `/products/${l.productHandle}`,
    })),
  }
}
