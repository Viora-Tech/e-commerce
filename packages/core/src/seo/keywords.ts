/** SOURCE OF TRUTH: what "Suggest keywords" knows about a product — WHAT: the facts the keyword writer gets (title, brand, type, category breadcrumb, description, price range, the keywords it has now) and the real Search Console queries for its page / WHY: the product page (single) and a bulk run send the model the same facts, read inside RLS */
import type { SeoKeywordsInput } from '@commerce/ai'
import { product, type StoreTx, variant } from '@commerce/db'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { seoBodyText } from './checks'
import { type PageSearchQuery, searchQueriesForPath } from './search-queries'

let taxonomy: Promise<Map<string, string>> | null = null

/** A category id's breadcrumb (`Electronics > Computer Accessories > Mice`), or '' when unknown. */
export async function categoryPath(categoryId: string | null | undefined): Promise<string> {
  if (!categoryId) return ''
  taxonomy ??= import('../catalog/product-taxonomy.json').then(
    (mod) => new Map((mod.default as unknown as [string, string][]).map(([k, v]) => [k, v])),
  )
  const names = await taxonomy
  // Ids are hierarchical (`el-4-2` sits under `el-4`), so each prefix is one level up.
  const parts = categoryId.split('-')
  return parts
    .map((_, i) => names.get(parts.slice(0, i + 1).join('-')))
    .filter((name): name is string => Boolean(name))
    .join(' > ')
}

/** The real searches that brought visitors to a product's page, or none (unsaved, no source). */
export async function productSearchQueries(
  tx: StoreTx,
  storeId: string,
  productId: string | null | undefined,
): Promise<PageSearchQuery[]> {
  if (!productId) return []
  const [row] = await tx
    .select({ handle: product.handle })
    .from(product)
    .where(eq(product.id, productId))
  return row ? searchQueriesForPath(tx, storeId, `/products/${row.handle}`) : []
}

/** Everything the keyword writer gets for one saved product, or null when it is not found. */
export async function productKeywordFacts(
  tx: StoreTx,
  storeId: string,
  productId: string,
): Promise<SeoKeywordsInput | null> {
  const [row] = await tx
    .select({
      title: product.title,
      handle: product.handle,
      productType: product.productType,
      vendor: product.vendor,
      categoryId: product.categoryId,
      description: product.description,
      seoKeywords: product.seoKeywords,
    })
    .from(product)
    .where(eq(product.id, productId))
  if (!row) return null
  const [price] = await tx
    .select({
      min: sql<number | null>`min(${variant.pricePaise})::int`,
      max: sql<number | null>`max(${variant.pricePaise})::int`,
    })
    .from(variant)
    .where(and(eq(variant.productId, productId), isNull(variant.archivedAt)))
  return {
    title: row.title,
    productType: row.productType ?? '',
    vendor: row.vendor ?? '',
    category: await categoryPath(row.categoryId),
    description: seoBodyText(row.description).slice(0, 5000),
    minPricePaise: price?.min ?? null,
    maxPricePaise: price?.max ?? null,
    searchQueries: await searchQueriesForPath(tx, storeId, `/products/${row.handle}`),
    current: row.seoKeywords,
  }
}
