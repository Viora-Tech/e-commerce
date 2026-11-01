/** SOURCE OF TRUTH: add-to-cart limit — WHAT: Settings → Checkout → Cart limit (#156): the most units of one product (all its variants together) a cart may hold, store-wide, with a per-product override, and the pure helpers `addToCart`, `setLineQuantity`, `getCart` and `placeOrder` share / WHY: a bot adding 9,999 of an item reads the stock level off the cart; a cap per product per cart stops that, and resellers buying a drop out */
import { z } from 'zod'

/** Highest limit a merchant can set, and most products with their own limit. */
export const CART_LIMIT_MAX = 9_999
const CART_LIMIT_OVERRIDES_MAX = 500

const CartLimitOverrideSchema = z.object({
  productId: z.string().uuid(),
  max: z.number().int().min(1).max(CART_LIMIT_MAX),
})
export type CartLimitOverride = z.infer<typeof CartLimitOverrideSchema>

export const CartLimitSchema = z.object({
  /** Most units of one product per cart; 0 means no limit. */
  maxPerProduct: z.number().int().min(0).max(CART_LIMIT_MAX).default(0),
  /** Products with their own limit, one row each (the last one wins on a repeat). */
  overrides: z
    .array(CartLimitOverrideSchema)
    .max(CART_LIMIT_OVERRIDES_MAX)
    .default([])
    .transform((rows) => [...new Map(rows.map((r) => [r.productId, r])).values()]),
})
export type CartLimit = z.infer<typeof CartLimitSchema>

/** The most of this product one cart may hold; null when nothing caps it. */
export function productCartLimit(limit: CartLimit, productId: string): number | null {
  const own = limit.overrides.find((o) => o.productId === productId)
  if (own) return own.max
  return limit.maxPerProduct > 0 ? limit.maxPerProduct : null
}

/**
 * How many units one line (a variant) may hold, given what the cart's other lines of the same
 * product already hold. Null when the product has no limit. Never below 0.
 */
export function lineRoom(
  limit: CartLimit,
  productId: string,
  otherLinesOfProduct: number,
): number | null {
  const max = productCartLimit(limit, productId)
  return max === null ? null : Math.max(0, max - otherLinesOfProduct)
}

/**
 * The first product in an order over its limit, with the limit, or null when every product is
 * within it. Lines of one product's variants are counted together; gift cards are never capped.
 */
export function cartLimitBreach(
  limit: CartLimit,
  lines: readonly { productId: string; quantity: number; giftCard?: boolean; title?: string }[],
): { productId: string; title: string; max: number } | null {
  const totals = new Map<string, { quantity: number; title: string }>()
  for (const l of lines) {
    if (l.giftCard) continue
    const t = totals.get(l.productId)
    totals.set(l.productId, { quantity: (t?.quantity ?? 0) + l.quantity, title: l.title ?? '' })
  }
  for (const [productId, t] of totals) {
    const max = productCartLimit(limit, productId)
    if (max !== null && t.quantity > max) return { productId, title: t.title, max }
  }
  return null
}
