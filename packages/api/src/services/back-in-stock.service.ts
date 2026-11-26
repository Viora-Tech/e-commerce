import { product, type StoreTx, variant } from '@commerce/db'
import { eq, inArray } from 'drizzle-orm'

export type VariantInfo = { label: string; productTitle: string; variantTitle: string | null }

/**
 * Reads the Back in stock router needs beyond the plugin's own services: each variant's
 * "Product / Variant" label and its two parts, in one statement (Analytics, Signups, export).
 */
export async function variantLabels(
  tx: StoreTx,
  variantIds: readonly string[],
): Promise<Map<string, VariantInfo>> {
  const ids = [...new Set(variantIds)]
  if (ids.length === 0) return new Map()
  const rows = await tx
    .select({ id: variant.id, productTitle: product.title, variantTitle: variant.title })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(inArray(variant.id, ids))
  return new Map(
    rows.map((r) => {
      const own = r.variantTitle && r.variantTitle !== 'Default' ? r.variantTitle : null
      return [
        r.id,
        {
          label: own ? `${r.productTitle} / ${own}` : r.productTitle,
          productTitle: r.productTitle,
          variantTitle: own,
        },
      ]
    }),
  )
}
