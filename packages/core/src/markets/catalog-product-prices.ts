/** SOURCE OF TRUTH: catalogProductPrices
 * WHAT:  Markets › Catalogs › one catalog's price table (audit #161, after Shopify): the products
 *        it includes (or leaves out), a page at a time, each with its variants' own prices.
 * WHY:   Fixed prices were typed through a variant picker with no view of what the catalog
 *        sells; the table shows every product and lets a price be set on its row.
 * WHERE: `catalogs.productPrices` (api), the catalog page's "Products and prices" card.
 */
import { catalog, media, product, productMedia, variant } from '@commerce/db'
import { and, asc, count, eq, ilike, inArray, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { StoreContext } from '../context'
import { CatalogError, chosenProducts } from './catalogs'

export const CatalogProductPricesSchema = z.object({
  id: z.uuid(),
  /** The Included tab, or Excluded (products the catalog does not sell). */
  included: z.boolean().default(true),
  search: z.string().trim().max(200).optional(),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(50).default(20),
})
export type CatalogProductPricesInput = z.input<typeof CatalogProductPricesSchema>

export type CatalogProductPriceRow = {
  productId: string
  title: string
  imageUrl: string | null
  variants: { variantId: string; title: string; pricePaise: number | null }[]
}

/** One page of a catalog's included or excluded live products, A–Z, with their variants. */
export async function catalogProductPrices(
  ctx: StoreContext,
  raw: CatalogProductPricesInput,
): Promise<{ rows: CatalogProductPriceRow[]; total: number }> {
  const input = CatalogProductPricesSchema.parse(raw)
  const [row] = await ctx.tx
    .select({ scope: catalog.scope })
    .from(catalog)
    .where(eq(catalog.id, input.id))
  if (!row) throw new CatalogError('CATALOG_NOT_FOUND', 'Catalog not found', ctx.storeId)
  // "All products" leaves nothing out; "Chosen" sells its products and its collections' products.
  const membership =
    row.scope === 'all'
      ? input.included
        ? undefined
        : sql`false`
      : input.included
        ? sql`${product.id} in ${chosenProducts(input.id)}`
        : sql`${product.id} not in ${chosenProducts(input.id)}`
  const where = and(
    eq(product.status, 'active'),
    eq(product.isSystemTest, false),
    membership,
    input.search ? ilike(product.title, `%${input.search}%`) : undefined,
  )
  const [counted] = await ctx.tx.select({ n: count() }).from(product).where(where)
  const products = await ctx.tx
    .select({ productId: product.id, title: product.title })
    .from(product)
    .where(where)
    .orderBy(asc(product.title), asc(product.id))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  const ids = products.map((p) => p.productId)
  if (ids.length === 0) return { rows: [], total: Number(counted?.n ?? 0) }
  const [variants, images] = await Promise.all([
    ctx.tx
      .select({
        productId: variant.productId,
        variantId: variant.id,
        title: variant.title,
        pricePaise: variant.pricePaise,
      })
      .from(variant)
      .where(and(inArray(variant.productId, ids), isNull(variant.archivedAt)))
      .orderBy(asc(variant.position)),
    ctx.tx
      .select({ productId: productMedia.productId, url: media.url })
      .from(productMedia)
      .innerJoin(media, eq(media.id, productMedia.mediaId))
      .where(and(inArray(productMedia.productId, ids), eq(productMedia.position, 0))),
  ])
  return {
    total: Number(counted?.n ?? 0),
    rows: products.map((p) => ({
      ...p,
      imageUrl: images.find((i) => i.productId === p.productId)?.url ?? null,
      variants: variants
        .filter((v) => v.productId === p.productId)
        .map(({ productId: _p, ...v }) => v),
    })),
  }
}
