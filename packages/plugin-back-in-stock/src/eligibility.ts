import { resolvePreorderSettings } from '@commerce/core/preorder'
import { product, type StoreTx, variant } from '@commerce/db'
import { eq } from 'drizzle-orm'

/**
 * A variant is eligible for a "notify me" signup only while it is not on
 * pre-order: a pre-order variant is purchasable regardless of stock, so it
 * never reaches the sold-out state this app exists for.
 */
export async function variantIsEligible(tx: StoreTx, variantId: string): Promise<boolean> {
  const [row] = await tx
    .select({
      preorderEnabled: product.preorderEnabled,
      preorderShipDate: product.preorderShipDate,
      preorderShipsInDays: product.preorderShipsInDays,
      preorderLimit: product.preorderLimit,
      preorderButtonLabel: product.preorderButtonLabel,
      preorderPaymentMode: product.preorderPaymentMode,
      preorderDepositPaise: product.preorderDepositPaise,
      preorderDepositPercent: product.preorderDepositPercent,
      preorderOverride: variant.preorderOverride,
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(eq(variant.id, variantId))
  if (!row) return false
  const resolved = resolvePreorderSettings(row, row.preorderOverride)
  return !resolved.enabled
}
