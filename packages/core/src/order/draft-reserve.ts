import { address, order, orderLine } from '@commerce/db'
import { and, eq, isNotNull, lt } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { releaseReserved, routeAndReserve } from './routing-service'

/**
 * "Reserve items" on a draft (#1030), like Shopify's: the draft's stock is held (counted as
 * committed, so no one else can buy it) until a date. Converting, deleting or the date passing
 * gives it back. Prices on a draft are already fixed: each line keeps the price it was saved with.
 */

export class DraftHoldInPast extends CommerceError {
  constructor(storeId: string) {
    super('DRAFT_HOLD_IN_PAST', 'Pick a date in the future to hold the items until', { storeId })
  }
}

type Held = { variantId: string; locationId: string; quantity: number }[]

/** Give back what a draft holds and clear the hold. */
export async function releaseDraftHold(
  ctx: StoreContext,
  draft: { id: string; draftReserved: Held | null },
): Promise<void> {
  if (!draft.draftReserved?.length) return
  await releaseReserved(ctx, draft.draftReserved)
  await ctx.tx
    .update(order)
    .set({ draftReserved: null, reservedUntil: null })
    .where(eq(order.id, draft.id))
}

/**
 * Hold the draft's items until `until`, routed like a checkout to its shipping state. A hold
 * already on it is replaced, so this also re-holds after the lines change. Not enough stock is
 * refused (OutOfStock) and nothing is held.
 */
export async function reserveDraft(ctx: StoreContext, id: string, until: Date, now = new Date()) {
  if (until.getTime() <= now.getTime()) throw new DraftHoldInPast(ctx.storeId)
  const [o] = await ctx.tx
    .select({
      id: order.id,
      status: order.status,
      draftReserved: order.draftReserved,
      shippingAddressId: order.shippingAddressId,
    })
    .from(order)
    .where(eq(order.id, id))
    .for('update')
  if (o?.status !== 'draft') return null
  await releaseDraftHold(ctx, o)
  const lines = await ctx.tx.select().from(orderLine).where(eq(orderLine.orderId, id))
  const [shipTo] = o.shippingAddressId
    ? await ctx.tx
        .select({ stateCode: address.stateCode })
        .from(address)
        .where(eq(address.id, o.shippingAddressId))
    : []
  const { reserved } = await routeAndReserve(ctx, {
    lines: lines.flatMap((l) =>
      l.variantId
        ? [
            {
              key: l.id,
              variantId: l.variantId,
              quantity: l.quantity,
              giftCard: l.giftCard,
              preorder: null,
            },
          ]
        : [],
    ),
    buyerState: shipTo?.stateCode ?? null,
  })
  await ctx.tx
    .update(order)
    .set({ draftReserved: reserved, reservedUntil: until })
    .where(eq(order.id, id))
  return { reservedUntil: until, units: reserved.reduce((n, r) => n + r.quantity, 0) }
}

/** Stop holding a draft's items. */
export async function releaseDraft(ctx: StoreContext, id: string): Promise<boolean> {
  const [o] = await ctx.tx
    .select({ id: order.id, status: order.status, draftReserved: order.draftReserved })
    .from(order)
    .where(eq(order.id, id))
    .for('update')
  if (o?.status !== 'draft') return false
  await releaseDraftHold(ctx, o)
  return true
}

/** The worker's sweep: every draft in this store whose hold date has passed gives its stock back. */
export async function releaseExpiredDraftHolds(ctx: StoreContext, now = new Date()) {
  const rows = await ctx.tx
    .select({ id: order.id, draftReserved: order.draftReserved })
    .from(order)
    .where(
      and(eq(order.status, 'draft'), isNotNull(order.reservedUntil), lt(order.reservedUntil, now)),
    )
    .for('update')
  for (const row of rows) await releaseDraftHold(ctx, row)
  return rows.length
}
