/** SOURCE OF TRUTH: a product's weight set from a purchase order line (#1054) — WHAT: saves the
 * weight from the supplier's packing list onto the product variant and re-splits the order's (and
 * its shipment's) weight-based charges. WHY: freight is often split by weight, and many products
 * have no weight yet when their first container arrives; the packing list is where it's known.
 */
import { purchaseOrderLine, type StoreTx, variant } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import { lockCostingGroup, recost } from './costing'
import { InventoryError } from './levels'

/** The heaviest unit we accept: 1,000 kg, the same bound as the product form. */
export const MAX_LINE_WEIGHT_GRAMS = 1_000_000

/**
 * Set the weight of one product on a purchase order, in grams per unit. Works in every order
 * state (the packing list usually arrives with the goods), because it changes the product, not
 * the order's lines. `null` clears it.
 */
export async function setPurchaseLineWeight(
  tx: StoreTx,
  storeId: string,
  purchaseOrderId: string,
  variantId: string,
  weightGrams: number | null,
): Promise<void> {
  if (
    weightGrams !== null &&
    (!Number.isInteger(weightGrams) || weightGrams < 0 || weightGrams > MAX_LINE_WEIGHT_GRAMS)
  ) {
    throw new InventoryError('WEIGHT_INVALID', 'Enter a weight in grams', { storeId })
  }
  const group = await lockCostingGroup(tx, storeId, { purchaseOrderId })
  const [onOrder] = await tx
    .select({ id: purchaseOrderLine.id })
    .from(purchaseOrderLine)
    .where(
      and(
        eq(purchaseOrderLine.purchaseOrderId, purchaseOrderId),
        eq(purchaseOrderLine.variantId, variantId),
      ),
    )
    .limit(1)
  if (!onOrder) {
    throw new InventoryError('PO_LINE_NOT_FOUND', 'This product is not on the purchase order', {
      storeId,
    })
  }
  await tx
    .update(variant)
    .set({ weightGrams })
    .where(and(eq(variant.id, variantId), eq(variant.storeId, storeId)))
  await recost(tx, storeId, group)
}
