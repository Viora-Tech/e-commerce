import { cart, cartLine, discount, discountUsage, variant } from '@commerce/db'
import { and, count, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import {
  bestAutomaticDiscount,
  type DiscountCart,
  type DiscountContext,
  type DiscountOutcome,
  type DiscountRule,
  evaluateDiscount,
  normaliseCode,
} from './evaluate'

export type ResolvedDiscount = Extract<DiscountOutcome, { ok: true }>

/** Why a typed code was refused; deliberately coarse so codes cannot be probed. */
export type CodeRejection = 'invalid' | 'not_applicable' | 'min_subtotal' | 'limit_reached'

export type CodeCheck =
  | { ok: true; outcome: ResolvedDiscount }
  | { ok: false; reason: CodeRejection }

/** Cart lines in the shape the evaluator wants. */
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
  return { lines: rows, shippingPaise: 0 }
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
    case 'usage_limit':
    case 'customer_limit':
      return 'limit_reached'
    case 'no_eligible_items':
      return 'not_applicable'
    default:
      // disabled / not started / expired all read as "no such code" to the shopper.
      return 'invalid'
  }
}

/** Validate a typed code against a cart. Used by the storefront and by checkout. */
export async function checkDiscountCode(
  ctx: StoreContext,
  cartId: string,
  code: string,
  opts: { email?: string | null | undefined; now?: Date } = {},
): Promise<CodeCheck> {
  const rule = await findDiscountByCode(ctx, code)
  if (!rule) return { ok: false, reason: 'invalid' }
  const [dc, uses] = await Promise.all([
    loadDiscountCart(ctx, cartId),
    customerUsageCount(ctx, rule.id, opts.email),
  ])
  const outcome = evaluateDiscount(dc, rule, { now: opts.now, customerUses: uses })
  if (!outcome.ok) return { ok: false, reason: toCodeRejection(outcome.reason) }
  return { ok: true, outcome }
}

/**
 * The discount that applies to a cart right now: the shopper's code when it
 * is still valid, otherwise the best automatic offer. Returns the code
 * rejection too so the UI can drop a code that stopped working.
 */
export async function resolveCartDiscount(
  ctx: StoreContext,
  cartId: string,
  code: string | null | undefined,
  opts: { email?: string | null | undefined; now?: Date } = {},
): Promise<{ outcome: ResolvedDiscount | null; codeRejected: CodeRejection | null }> {
  if (code) {
    const r = await checkDiscountCode(ctx, cartId, code, opts)
    if (r.ok) return { outcome: r.outcome, codeRejected: null }
    const auto = await resolveAutomatic(ctx, cartId, opts)
    return { outcome: auto, codeRejected: r.reason }
  }
  return { outcome: await resolveAutomatic(ctx, cartId, opts), codeRejected: null }
}

async function resolveAutomatic(
  ctx: StoreContext,
  cartId: string,
  opts: { email?: string | null | undefined; now?: Date },
): Promise<ResolvedDiscount | null> {
  const rules = await listAutomaticDiscounts(ctx)
  if (rules.length === 0) return null
  const dc = await loadDiscountCart(ctx, cartId)
  const ctxFor = async (rule: DiscountRule): Promise<DiscountContext> => ({
    now: opts.now,
    customerUses: await customerUsageCount(ctx, rule.id, opts.email),
  })
  // Per-customer caps need a usage count per rule; evaluate one at a time.
  let best: ResolvedDiscount | null = null
  for (const rule of rules) {
    const r = bestAutomaticDiscount(dc, [rule], await ctxFor(rule))
    if (r && (!best || r.amountPaise > best.amountPaise)) best = r
  }
  return best
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
