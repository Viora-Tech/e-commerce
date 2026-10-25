import { cart, cartLine, collectionProduct, discount, discountUsage, variant } from '@commerce/db'
import { and, count, eq, inArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { combineDiscounts } from './combine'
import { shopperFor } from './eligibility'
import {
  type DiscountCart,
  type DiscountContext,
  type DiscountOutcome,
  type DiscountRule,
  evaluateDiscount,
  normaliseCode,
} from './evaluate'

export type ResolvedDiscount = Extract<DiscountOutcome, { ok: true }>

/** Why a typed code was refused; deliberately coarse so codes cannot be probed. */
export type CodeRejection =
  | 'invalid'
  | 'not_applicable'
  | 'min_subtotal'
  | 'min_quantity'
  | 'not_eligible'
  | 'limit_reached'

/** Who is checking out, as far as the caller knows. */
export type DiscountShopper = {
  email?: string | null | undefined
  /** Delivery state code, once an address is entered. */
  stateCode?: string | null | undefined
  now?: Date
}

export type CodeCheck =
  | { ok: true; outcome: ResolvedDiscount }
  | { ok: false; reason: CodeRejection }

/**
 * Cart lines in the shape the evaluator wants, each with the collections its
 * product belongs to, so a discount scoped to collections can find its lines.
 * Membership is read from `collection_product`, the same rows the storefront
 * lists collections from: manual picks, and automatic collections' rule matches
 * as `syncAutomaticCollection` materialised them. Draft collections count too,
 * so a hidden collection can target a discount.
 */
export async function loadDiscountCart(ctx: StoreContext, cartId: string): Promise<DiscountCart> {
  const rows = await ctx.tx
    .select({
      productId: variant.productId,
      quantity: cartLine.quantity,
      unitPricePaise: cartLine.unitPricePaise,
    })
    .from(cartLine)
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .where(eq(cartLine.cartId, cartId))
  const collectionsByProduct = await productCollections(ctx, [
    ...new Set(rows.map((r) => r.productId)),
  ])
  const lines = rows.map((r) => ({
    ...r,
    collectionIds: collectionsByProduct.get(r.productId) ?? [],
  }))
  return { lines, shippingPaise: 0 }
}

/** Collection ids per product, for the products given. */
async function productCollections(
  ctx: StoreContext,
  productIds: string[],
): Promise<Map<string, string[]>> {
  const byProduct = new Map<string, string[]>()
  if (productIds.length === 0) return byProduct
  const rows = await ctx.tx
    .select({
      productId: collectionProduct.productId,
      collectionId: collectionProduct.collectionId,
    })
    .from(collectionProduct)
    .where(inArray(collectionProduct.productId, productIds))
  for (const r of rows) {
    byProduct.set(r.productId, [...(byProduct.get(r.productId) ?? []), r.collectionId])
  }
  return byProduct
}

export async function findDiscountByCode(
  ctx: StoreContext,
  code: string,
): Promise<DiscountRule | null> {
  const [row] = await ctx.tx
    .select()
    .from(discount)
    .where(and(eq(discount.code, normaliseCode(code)), eq(discount.kind, 'code')))
  return row ?? null
}

export async function listAutomaticDiscounts(ctx: StoreContext): Promise<DiscountRule[]> {
  return ctx.tx
    .select()
    .from(discount)
    .where(and(eq(discount.kind, 'automatic'), eq(discount.status, 'active')))
}

/** Times this email already redeemed the discount; per-customer caps key on email. */
export async function customerUsageCount(
  ctx: StoreContext,
  discountId: string,
  email: string | null | undefined,
): Promise<number> {
  if (!email) return 0
  const [row] = await ctx.tx
    .select({ n: count() })
    .from(discountUsage)
    .where(
      and(eq(discountUsage.discountId, discountId), eq(discountUsage.email, email.toLowerCase())),
    )
  return row?.n ?? 0
}

function toCodeRejection(reason: Exclude<DiscountOutcome, { ok: true }>['reason']): CodeRejection {
  switch (reason) {
    case 'min_subtotal':
      return 'min_subtotal'
    case 'min_quantity':
      return 'min_quantity'
    case 'customer_not_eligible':
      return 'not_eligible'
    case 'usage_limit':
    case 'customer_limit':
      return 'limit_reached'
    case 'region':
    case 'no_eligible_items':
      return 'not_applicable'
    default:
      // disabled / not started / expired all read as "no such code" to the shopper.
      return 'invalid'
  }
}

/** The evaluator's context for one rule: the clock, this shopper's uses, who and where. */
async function contextFor(
  ctx: StoreContext,
  rule: DiscountRule,
  opts: DiscountShopper,
  customer: DiscountContext['customer'],
): Promise<DiscountContext> {
  return {
    now: opts.now,
    customerUses: await customerUsageCount(ctx, rule.id, opts.email),
    customer,
    stateCode: opts.stateCode,
  }
}

/** Validate a typed code against a cart. Used by the storefront and by checkout. */
export async function checkDiscountCode(
  ctx: StoreContext,
  cartId: string,
  code: string,
  opts: DiscountShopper = {},
): Promise<CodeCheck> {
  const rule = await findDiscountByCode(ctx, code)
  if (!rule) return { ok: false, reason: 'invalid' }
  const [dc, customer] = await Promise.all([
    loadDiscountCart(ctx, cartId),
    shopperFor(ctx.tx, opts.email, [rule], opts.now),
  ])
  const outcome = evaluateDiscount(dc, rule, await contextFor(ctx, rule, opts, customer))
  if (!outcome.ok) return { ok: false, reason: toCodeRejection(outcome.reason) }
  return { ok: true, outcome }
}

/**
 * The discount in force on a cart right now: the shopper's code when it is still valid,
 * plus the automatic discounts it combines with (Shopify's Combinations), or the best
 * automatic offers alone. Several merge into one outcome (see `combineDiscounts`). Returns
 * the code rejection too so the UI can drop a code that stopped working.
 */
export async function resolveCartDiscount(
  ctx: StoreContext,
  cartId: string,
  code: string | null | undefined,
  opts: DiscountShopper = {},
): Promise<{ outcome: ResolvedDiscount | null; codeRejected: CodeRejection | null }> {
  const [codeRule, automatic] = await Promise.all([
    code ? findDiscountByCode(ctx, code) : Promise.resolve(null),
    listAutomaticDiscounts(ctx),
  ])
  if (!codeRule && automatic.length === 0) {
    return { outcome: null, codeRejected: code ? 'invalid' : null }
  }
  const rules = codeRule ? [codeRule, ...automatic] : automatic
  const [dc, customer] = await Promise.all([
    loadDiscountCart(ctx, cartId),
    shopperFor(ctx.tx, opts.email, rules, opts.now),
  ])
  // Per-customer caps need a usage count per rule; evaluate one at a time.
  const contexts = new Map<string, DiscountContext>()
  for (const rule of rules) contexts.set(rule.id, await contextFor(ctx, rule, opts, customer))
  const evaluate = (rule: DiscountRule) => evaluateDiscount(dc, rule, contexts.get(rule.id))

  let codeOutcome: ResolvedDiscount | null = null
  let codeRejected: CodeRejection | null = code && !codeRule ? 'invalid' : null
  if (codeRule) {
    const r = evaluate(codeRule)
    if (r.ok) codeOutcome = r
    else codeRejected = toCodeRejection(r.reason)
  }
  const autos = automatic.map(evaluate).filter((r): r is ResolvedDiscount => r.ok)
  return { outcome: combineDiscounts(dc, codeOutcome, autos, contexts), codeRejected }
}

/** Persist the code on the cart so it survives between cart, checkout and a refresh. */
export async function setCartDiscountCode(
  ctx: StoreContext,
  cartId: string,
  code: string | null,
): Promise<void> {
  await ctx.tx
    .update(cart)
    .set({ discountCode: code ? normaliseCode(code) : null })
    .where(eq(cart.id, cartId))
}
