import { product, type StoreTx, variant } from '@commerce/db'
import { eq, inArray } from 'drizzle-orm'

/** Reads the Back in stock router needs beyond the plugin's own services. */
export async function variantLabel(tx: StoreTx, variantId: string): Promise<string> {
  const [row] = await tx
    .select({ productTitle: product.title, variantTitle: variant.title })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(eq(variant.id, variantId))
  if (!row) return variantId
  return row.variantTitle === 'Default'
    ? row.productTitle
    : `${row.productTitle} / ${row.variantTitle}`
}

export type VariantInfo = { label: string; productTitle: string; variantTitle: string | null }

/** `variantLabel` for many variants in one statement (the Analytics list and the export). */
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
