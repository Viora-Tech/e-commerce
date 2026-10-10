import { inventoryAdjustment, inventoryLevel, newId, sellableLevel, variant } from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'

/*
 * Stock an open order holds. Placing an order (or converting a draft) adds each
 * tracked line's quantity to `reserved` (shown as Committed) at the location it
 * was reserved at, which becomes the order's parcel (fulfillment-orders.ts).
 * Moves name that location; without one they fall back to the variant's
 * selling row (the inventory_level row with fulfils_online), as before parcels.
 *
 * - Packing n units: on_hand and reserved both drop by n (the goods left).
 * - Cancelling: reserved drops by the unpacked remainder; on_hand is untouched.
 *
 * Callers make these idempotent by moving the order line's fulfilled_quantity
 * (or the order's status) under a row lock first and passing only the change,
 * so a repeated request finds nothing left to move and calls in with zero.
 */

export type StockMove = {
  variantId: string
  quantity: number
  /** The parcel's location; omitted, the variant's selling row. */
  locationId?: string | undefined
}

const levelOf = (move: StockMove) =>
  and(
    eq(inventoryLevel.variantId, move.variantId),
    move.locationId ? eq(inventoryLevel.locationId, move.locationId) : sellableLevel,
  )

async function isTracked(ctx: StoreContext, variantId: string): Promise<boolean> {
  const [v] = await ctx.tx
    .select({ trackInventory: variant.trackInventory })
    .from(variant)
    .where(eq(variant.id, variantId))
  return v?.trackInventory ?? false
}

/** Units that left the building: on hand and committed drop together, logged as sold. */
export async function shipCommittedStock(ctx: StoreContext, move: StockMove): Promise<void> {
  if (move.quantity <= 0) return
  // Untracked variants were never reserved and keep no count.
  if (!(await isTracked(ctx, move.variantId))) return
  const [level] = await ctx.tx
    .update(inventoryLevel)
    .set({
      onHand: sql`greatest(0, ${inventoryLevel.onHand} - ${move.quantity})`,
      reserved: sql`greatest(0, ${inventoryLevel.reserved} - ${move.quantity})`,
    })
    .where(levelOf(move))
    .returning({ locationId: inventoryLevel.locationId })
  if (!level) return
  await ctx.tx.insert(inventoryAdjustment).values({
    id: newId(),
    storeId: ctx.storeId,
    variantId: move.variantId,
    locationId: level.locationId,
    delta: -move.quantity,
    reason: 'sold',
    note: null,
  })
}

/** Units the order no longer wants: committed drops, on hand stays. */
export async function releaseCommittedStock(ctx: StoreContext, move: StockMove): Promise<void> {
  if (move.quantity <= 0) return
  if (!(await isTracked(ctx, move.variantId))) return
  await ctx.tx
    .update(inventoryLevel)
    .set({ reserved: sql`greatest(0, ${inventoryLevel.reserved} - ${move.quantity})` })
    .where(levelOf(move))
}
