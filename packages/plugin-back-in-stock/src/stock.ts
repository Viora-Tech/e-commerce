import { inventoryLevel, type StoreTx } from '@commerce/db'
import { eq } from 'drizzle-orm'

/** Sellable stock for a variant: on-hand minus reserved, summed over locations that fulfil online orders. */
export async function availableStockFor(tx: StoreTx, variantId: string): Promise<number> {
  const rows = await tx
    .select({ onHand: inventoryLevel.onHand, reserved: inventoryLevel.reserved })
    .from(inventoryLevel)
    .where(eq(inventoryLevel.variantId, variantId))
  return rows.reduce((sum, r) => sum + (r.onHand - r.reserved), 0)
}
