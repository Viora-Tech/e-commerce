/** SOURCE OF TRUTH: bulkSetShipping
 * WHAT:  The products list's "Set weight and box": one weight and/or one box for every live
 *        variant of the chosen products, optionally only the variants with a given option value.
 * WHY:   Waimers has about 1,000 variants and set weights one by one (owner, 10 Nov 2026).
 * WHERE: `products.bulk` with `{ kind: 'shipping' }` (api routers/products.ts), the products list.
 */
import { type StoreTx, store, variant } from '@commerce/db'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { CommerceError } from '../errors'
import { parseShippingSettings } from '../shipping/settings'
import { noteProductEvent, noteProductsChanged, txStoreId } from './changes'

export type BulkShippingAction = {
  kind: 'shipping'
  /** The product's own weight in grams (packing comes from the box). Omitted, left as it is. */
  weightGrams?: number | undefined
  /** A box from Settings › Shipping; null clears it. Omitted, left as it is. */
  boxPresetId?: string | null | undefined
  /** Only variants with this option value, like "XL" in "XL / Black". Omitted, every variant. */
  optionValue?: string | undefined
}

/** True when one of the variant title's options ("XL / Black") is `value`, ignoring case. */
function variantHasOption(title: string, value: string): boolean {
  const want = value.trim().toLowerCase()
  return title.split('/').some((part) => part.trim().toLowerCase() === want)
}

/** Writes the weight and box onto the chosen products' live variants; returns how many changed. */
export async function bulkSetShipping(
  tx: StoreTx,
  productIds: string[],
  action: BulkShippingAction,
): Promise<number> {
  if (productIds.length === 0) return 0
  if (action.weightGrams === undefined && action.boxPresetId === undefined) return 0
  const storeId = await txStoreId(tx)
  if (action.boxPresetId) {
    const [s] = await tx
      .select({ shipping: store.shipping })
      .from(store)
      .where(eq(store.id, storeId))
    const boxes = parseShippingSettings(s?.shipping).boxPresets
    if (!boxes.some((b) => b.id === action.boxPresetId)) {
      throw new CommerceError('box_not_found', 'That box is not in Settings › Shipping.', {
        storeId,
      })
    }
  }
  const rows = await tx
    .select({ id: variant.id, productId: variant.productId, title: variant.title })
    .from(variant)
    .where(and(inArray(variant.productId, productIds), isNull(variant.archivedAt)))
  const match = action.optionValue?.trim()
  const chosen = match ? rows.filter((r) => variantHasOption(r.title, match)) : rows
  if (chosen.length === 0) return 0
  await tx
    .update(variant)
    .set({
      ...(action.weightGrams !== undefined ? { weightGrams: action.weightGrams } : {}),
      ...(action.boxPresetId !== undefined ? { boxPresetId: action.boxPresetId } : {}),
      updatedAt: new Date(),
    })
    .where(
      inArray(
        variant.id,
        chosen.map((r) => r.id),
      ),
    )
  const changed = [...new Set(chosen.map((r) => r.productId))]
  await noteProductsChanged(tx, changed)
  await noteProductEvent(tx, storeId, 'product.updated', changed)
  return chosen.length
}
