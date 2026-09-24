import { product, type StoreTx, variant } from '@commerce/db'
import { eq } from 'drizzle-orm'

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
