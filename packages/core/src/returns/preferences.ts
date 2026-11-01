/** SOURCE OF TRUTH: what a shopper asks for on a return — WHAT: the variants each order line can be swapped for (an exchange for another size), saving the shopper's choice (refund, store credit or an exchange with its variants), the store's auto-approve rule at request time, and the exchange wishes the admin shows / WHY: Shopify and Return Prime let the shopper pick an exchange and approve simple returns by rule; doing it in one module keeps `requestReturn` small and the exchange draft (`exchangeReturn`) able to send what was asked */
import {
  inventoryLevel,
  orderLine,
  product,
  returnRequest,
  returnRequestLine,
  variant,
} from '@commerce/db'
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { qualifiesForAutoApprove, type ReturnPolicy, type ReturnPreference } from './policy'

export type ExchangeOption = { variantId: string; title: string }

/**
 * Per order line, the other variants of the same product a shopper can swap to: active
 * product, not archived, and in stock when the variant tracks stock.
 */
export async function exchangeOptions(
  ctx: StoreContext,
  orderId: string,
): Promise<Map<string, ExchangeOption[]>> {
  const lines = await ctx.tx
    .select({ id: orderLine.id, variantId: orderLine.variantId, productId: variant.productId })
    .from(orderLine)
    .innerJoin(variant, eq(variant.id, orderLine.variantId))
    .where(and(eq(orderLine.orderId, orderId), eq(orderLine.giftCard, false)))
  const productIds = [...new Set(lines.map((l) => l.productId))]
  if (productIds.length === 0) return new Map()
  const siblings = await ctx.tx
    .select({
      id: variant.id,
      productId: variant.productId,
      title: variant.title,
      track: variant.trackInventory,
      available: sql<number>`coalesce((select sum(${inventoryLevel.onHand} - ${inventoryLevel.reserved}) from ${inventoryLevel} where ${inventoryLevel.variantId} = ${variant.id}), 0)::int`,
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(
      and(
        inArray(variant.productId, productIds),
        isNull(variant.archivedAt),
        eq(product.status, 'active'),
      ),
    )
    .orderBy(asc(variant.position))
  const map = new Map<string, ExchangeOption[]>()
  for (const l of lines) {
    map.set(
      l.id,
      siblings
        .filter((v) => v.productId === l.productId && v.id !== l.variantId)
        .filter((v) => !v.track || Number(v.available) > 0)
        .map((v) => ({ variantId: v.id, title: v.title })),
    )
  }
  return map
}

export type ReturnWishes = {
  preference?: ReturnPreference | undefined
  /** For an exchange: the variant wanted instead, per order line. */
  exchange?: { orderLineId: string; variantId: string }[] | undefined
}

/**
 * Saves what the shopper asked for on a new return and, when the store's rule takes it,
 * approves it on the spot. Returns true when it was auto-approved (the caller writes the
 * `return.approved` event through `approveReturn`).
 */
export async function applyReturnWishes(
  ctx: StoreContext,
  r: { id: string; orderId: string },
  input: ReturnWishes & {
    reason: string
    requestedBy: 'customer' | 'merchant'
    lines: Map<string, number>
  },
  policy: ReturnPolicy,
): Promise<boolean> {
  const preference = input.preference ?? null
  if (preference === 'exchange') {
    if (!policy.exchanges && input.requestedBy === 'customer') {
      throw new CommerceError('RETURN_NOT_ALLOWED', 'This shop does not take exchanges online.', {
        storeId: ctx.storeId,
      })
    }
    const options = await exchangeOptions(ctx, r.orderId)
    const wanted = (input.exchange ?? []).filter((e) => input.lines.has(e.orderLineId))
    if (wanted.length === 0) {
      throw new CommerceError('RETURN_NOT_ALLOWED', 'Pick what you want instead.', {
        storeId: ctx.storeId,
      })
    }
    for (const e of wanted) {
      if (!options.get(e.orderLineId)?.some((o) => o.variantId === e.variantId)) {
        throw new CommerceError('RETURN_NOT_ALLOWED', 'That option is not available.', {
          storeId: ctx.storeId,
        })
      }
      await ctx.tx
        .update(returnRequestLine)
        .set({ exchangeVariantId: e.variantId })
        .where(
          and(
            eq(returnRequestLine.returnRequestId, r.id),
            eq(returnRequestLine.orderLineId, e.orderLineId),
          ),
        )
    }
  }
  const lineRows = await ctx.tx
    .select({ id: orderLine.id, unitPricePaise: orderLine.unitPricePaise })
    .from(orderLine)
    .where(inArray(orderLine.id, [...input.lines.keys()]))
  const valuePaise = lineRows.reduce(
    (sum, l) => sum + l.unitPricePaise * (input.lines.get(l.id) ?? 0),
    0,
  )
  const auto = qualifiesForAutoApprove(policy, {
    reason: input.reason,
    valuePaise,
    requestedBy: input.requestedBy,
  })
  if (preference || auto) {
    await ctx.tx
      .update(returnRequest)
      .set({ preferredResolution: preference, autoApproved: auto })
      .where(eq(returnRequest.id, r.id))
  }
  return auto
}

/** What the shopper asked to swap to, per return line, with the variants' titles. */
export async function exchangeWishes(ctx: StoreContext, returnId: string) {
  const rows = await ctx.tx
    .select({
      orderLineId: returnRequestLine.orderLineId,
      quantity: returnRequestLine.quantity,
      variantId: variant.id,
      variantTitle: variant.title,
      from: orderLine.variantTitle,
      title: orderLine.title,
    })
    .from(returnRequestLine)
    .innerJoin(variant, eq(variant.id, returnRequestLine.exchangeVariantId))
    .innerJoin(orderLine, eq(orderLine.id, returnRequestLine.orderLineId))
    .where(eq(returnRequestLine.returnRequestId, returnId))
  return rows
}

/** The lines `exchangeReturn` sends when the shopper chose variants: each wish, else the same. */
export async function exchangeLinesFor(
  ctx: StoreContext,
  returnId: string,
): Promise<{ variantId: string; quantity: number }[] | null> {
  const rows = await ctx.tx
    .select({
      wanted: returnRequestLine.exchangeVariantId,
      original: orderLine.variantId,
      quantity: returnRequestLine.quantity,
    })
    .from(returnRequestLine)
    .innerJoin(orderLine, eq(orderLine.id, returnRequestLine.orderLineId))
    .where(eq(returnRequestLine.returnRequestId, returnId))
  if (!rows.some((r) => r.wanted)) return null
  return rows.map((r) => ({ variantId: r.wanted ?? r.original, quantity: r.quantity }))
}
