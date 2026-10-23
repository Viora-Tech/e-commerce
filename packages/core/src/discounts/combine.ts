/** SOURCE OF TRUTH: discount combinations — WHAT: which product, order and shipping discounts apply together on one cart, the shopper's code first, and the merged amount / WHY: Shopify's "Combinations" setting; resolve, checkout and the order all read the merged outcome so the totals agree */
import {
  type DiscountCart,
  type DiscountClass,
  type DiscountContext,
  type DiscountOutcome,
  type DiscountRule,
  discountClass,
  evaluateDiscount,
  subtotalPaise,
} from './evaluate'

type Applied = Extract<DiscountOutcome, { ok: true }>

/** Two discounts stack only when each allows the other's class. */
export function combinable(a: DiscountRule, b: DiscountRule): boolean {
  return Boolean(a.combinesWith?.[discountClass(b)] && b.combinesWith?.[discountClass(a)])
}

/** What an outcome is worth to the shopper, free shipping counted at the cart's shipping. */
const worth = (o: Applied, cart: DiscountCart): number =>
  o.amountPaise + (o.freeShipping ? (cart.shippingPaise ?? 0) : 0)

/**
 * The discounts that apply together. The shopper's code (when it applies) is always kept;
 * otherwise the most valuable automatic discount leads. Others join, most valuable first,
 * while they combine with everything already chosen, one per class (product, order,
 * shipping). An order discount then works on what the product discount left, as Shopify
 * applies them. One discount comes back unchanged; several merge into one outcome whose
 * `parts` list each, with `discount` the first.
 */
export function combineDiscounts(
  cart: DiscountCart,
  code: Applied | null,
  automatic: Applied[],
  contexts: Map<string, DiscountContext>,
): Applied | null {
  const ranked = [...automatic].sort((a, b) => worth(b, cart) - worth(a, cart))
  const chosen: Applied[] = []
  const taken = new Set<DiscountClass>()
  for (const o of code ? [code, ...ranked] : ranked) {
    const cls = discountClass(o.discount)
    if (taken.has(cls)) continue
    if (!chosen.every((c) => combinable(c.discount, o.discount))) continue
    chosen.push(o)
    taken.add(cls)
  }
  if (chosen.length <= 1) return chosen[0] ?? null

  const productOff = chosen
    .filter((o) => discountClass(o.discount) === 'products')
    .reduce((n, o) => n + o.amountPaise, 0)
  const parts = chosen.map((o) => {
    if (discountClass(o.discount) !== 'order' || productOff === 0) return o
    const again = evaluateDiscount(cart, o.discount, {
      ...contexts.get(o.discount.id),
      alreadyOffPaise: productOff,
    })
    return again.ok ? again : { ...o, amountPaise: 0 }
  })
  const shipping = parts.find((o) => o.freeShipping)
  const [first] = parts as [Applied, ...Applied[]]
  return {
    ok: true,
    discount: first.discount,
    amountPaise: Math.min(
      parts.reduce((n, o) => n + o.amountPaise, 0),
      subtotalPaise(cart.lines),
    ),
    freeShipping: Boolean(shipping),
    freeShippingMaxPaise: shipping?.freeShippingMaxPaise ?? null,
    label: parts.map((o) => o.label).join(' + '),
    parts,
  }
}
