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
  // A catalog's fixed price (Markets › Catalogs) is one unit's: such a line is that times the
  // quantity, and the total adds the lines up.
  const fixed = (l: CartView['lines'][number]) => pricing?.fixedMinor?.[l.variantId] !== undefined
  const linePrice = (l: CartView['lines'][number]) =>
    fixed(l)
      ? presentmentCents(l.unitPricePaise, pricing, l.variantId) * l.quantity
      : presentmentCents(l.linePaise, pricing)
  const anyFixed = cart.lines.some(fixed)
  return {
    itemCount: cart.itemCount,
    totalPrice: anyFixed
      ? cart.lines.reduce((n, l) => n + linePrice(l), 0)
      : presentmentCents(cart.subtotalPaise, pricing),
    items: cart.lines.map((l) => ({
      id: l.variantId,
      quantity: l.quantity,
      title: l.productTitle,
      price: presentmentCents(l.unitPricePaise, pricing, l.variantId),
      linePrice: linePrice(l),
      product: null,
      variantTitle: l.variantTitle,
      image: l.imageUrl ? { url: l.imageUrl, alt: l.productTitle } : null,
      url: `/products/${l.productHandle}`,
    })),
  }
}
