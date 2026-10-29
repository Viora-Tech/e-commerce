import { notSystemTest, priceRange } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { media, product, productMedia, sellableStock, variant } from '@commerce/db'
import { and, asc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import type { ProductStatus } from './product.service'

// The product and variant pickers: the draft order editor's variant search and the
// "Select products" dialog. Services are the only code that runs queries.

export type VariantSearchRow = {
  variantId: string
  productId: string
  title: string
  variantTitle: string
  sku: string | null
  /** Null: listed without a price yet (#913); the draft line needs one typed in. */
  pricePaise: number | null
  imageUrl: string | null
  /** A gift card: digital, so a draft of only these needs no shipping address. */
  giftCard: boolean
}

/**
 * Variant picker for the draft order editor: one row per sellable variant. `limit` caps the
 * number of matching *products*; every live variant of each one comes back, so a product with
 * many options is never cut off part way through its variants.
 */
export async function searchVariants(
  tx: StoreTx,
  input: { search?: string | undefined; limit?: number | undefined },
): Promise<VariantSearchRow[]> {
  const search = input.search?.trim()
  const live = and(isNull(variant.archivedAt), ne(product.status, 'archived'), notSystemTest)
  const matches = await tx
    .selectDistinct({ id: product.id, title: product.title })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(
      and(
        live,
        search
          ? or(
              ilike(product.title, `%${search}%`),
              ilike(variant.sku, `%${search}%`),
              ilike(variant.title, `%${search}%`),
            )
          : undefined,
      ),
    )
    .orderBy(asc(product.title), asc(product.id))
    .limit(input.limit ?? 20)
  if (matches.length === 0) return []
  return tx
    .select({
      variantId: variant.id,
      productId: product.id,
      title: product.title,
      variantTitle: variant.title,
      sku: variant.sku,
      pricePaise: variant.pricePaise,
      giftCard: product.isGiftCard,
      imageUrl: sql<string | null>`coalesce((
        select m.url from ${media} m where m.id = ${variant.mediaId}), (
        select m2.url from ${productMedia} pm join ${media} m2 on m2.id = pm.media_id
        where pm.product_id = ${product.id} order by pm.position limit 1))`,
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(
      and(
        live,
        inArray(
          product.id,
          matches.map((m) => m.id),
        ),
      ),
    )
    .orderBy(asc(product.title), asc(product.id), asc(variant.position))
}

export type PickProductVariant = {
  id: string
  title: string
  sku: string | null
  /** Null: listed without a price yet (#913). */
  pricePaise: number | null
  /** The variant's cost (weighted average landed cost); a purchase order in rupees starts from it. */
  costPaise: number | null
  available: number
}

export type PickProductRow = {
  id: string
  title: string
  status: ProductStatus
  imageUrl: string | null
  sku: string | null
  pricePaiseMin: number | null
  pricePaiseMax: number | null
  available: number
  variants: PickProductVariant[]
}

export type PickProductsInput = {
  search?: string | undefined
  collectionId?: string | undefined
  productType?: string | undefined
  status?: ProductStatus | undefined
  limit: number
}

/** Rows for the "Select products" dialog: each product with its variants so the dialog can expand them. */
export async function pickProducts(
  tx: StoreTx,
  input: PickProductsInput,
): Promise<PickProductRow[]> {
  const search = input.search?.trim()
  const rows = await tx
    .select({
      id: product.id,
      title: product.title,
      status: product.status,
      imageUrl: sql<string | null>`(
        select m.url from ${productMedia} pm join ${media} m on m.id = pm.media_id
        where pm.product_id = product.id order by pm.position limit 1)`,
    })
    .from(product)
    .where(
      and(
        notSystemTest,
        input.status ? eq(product.status, input.status) : ne(product.status, 'archived'),
        input.productType ? eq(product.productType, input.productType) : undefined,
        input.collectionId
          ? sql`exists (select 1 from collection_product cp where cp.product_id = ${product.id} and cp.collection_id = ${input.collectionId})`
          : undefined,
        search
          ? or(
              ilike(product.title, `%${search}%`),
              sql`exists (select 1 from variant v where v.product_id = ${product.id} and v.sku ilike ${`%${search}%`})`,
            )
          : undefined,
      ),
    )
    .orderBy(asc(product.title))
    .limit(input.limit)
  if (rows.length === 0) return []

  const variants = await tx
    .select({
      id: variant.id,
      productId: variant.productId,
      title: variant.title,
      sku: variant.sku,
      pricePaise: variant.pricePaise,
      costPaise: variant.costPaise,
      onHand: sellableStock.onHand,
      reserved: sellableStock.reserved,
    })
    .from(variant)
    .leftJoin(sellableStock, eq(sellableStock.variantId, variant.id))
    .where(
      and(
        inArray(
          variant.productId,
          rows.map((r) => r.id),
        ),
        isNull(variant.archivedAt),
      ),
    )
    .orderBy(asc(variant.position))

  return rows.map((r) => {
    const vs = variants
      .filter((v) => v.productId === r.id)
      .map((v) => ({
        id: v.id,
        title: v.title,
        sku: v.sku,
        pricePaise: v.pricePaise,
        costPaise: v.costPaise,
        available: Math.max(0, (v.onHand ?? 0) - (v.reserved ?? 0)),
      }))
    return {
      ...r,
      sku: vs[0]?.sku ?? null,
      pricePaiseMin: priceRange(vs.map((v) => v.pricePaise))?.min ?? null,
      pricePaiseMax: priceRange(vs.map((v) => v.pricePaise))?.max ?? null,
      available: vs.reduce((n, v) => n + v.available, 0),
      variants: vs,
    }
  })
}
