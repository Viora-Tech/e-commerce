import type { StoreTx } from '@commerce/db'
import { inventoryLevel, media, product, productMedia, variant } from '@commerce/db'
import { and, asc, count, desc, eq, ilike, inArray, sql } from 'drizzle-orm'

// Services are the only code that runs queries. They receive a store-scoped tx.

export type ProductStatus = 'draft' | 'active' | 'archived'

export type ProductListItem = {
  id: string
  handle: string
  title: string
  status: ProductStatus
  vendor: string | null
  productType: string | null
  imageUrl: string | null
  variantCount: number
  minPricePaise: number | null
  available: number
}

export async function listProducts(
  tx: StoreTx,
  input: {
    page: number
    perPage: number
    search?: string | undefined
    status?: ProductStatus | undefined
  },
): Promise<{ items: ProductListItem[]; total: number }> {
  const where = and(
    input.search ? ilike(product.title, `%${input.search}%`) : undefined,
    input.status ? eq(product.status, input.status) : undefined,
  )
  const [countRow] = await tx.select({ total: count() }).from(product).where(where)
  const total = countRow?.total ?? 0
  const rows = await tx
    .select()
    .from(product)
    .where(where)
    .orderBy(desc(product.createdAt))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  if (rows.length === 0) return { items: [], total }
  const ids = rows.map((r) => r.id)

  const variants = await tx
    .select({
      productId: variant.productId,
      pricePaise: variant.pricePaise,
      onHand: inventoryLevel.onHand,
      reserved: inventoryLevel.reserved,
    })
    .from(variant)
    .leftJoin(inventoryLevel, eq(inventoryLevel.variantId, variant.id))
    .where(inArray(variant.productId, ids))
  const images = await tx
    .select({ productId: productMedia.productId, url: media.url })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(and(inArray(productMedia.productId, ids), sql`${productMedia.position} = 0`))

  return {
    total,
    items: rows.map((r) => {
      const vs = variants.filter((v) => v.productId === r.id)
      return {
        id: r.id,
        handle: r.handle,
        title: r.title,
        status: r.status,
        vendor: r.vendor,
        productType: r.productType,
        imageUrl: images.find((i) => i.productId === r.id)?.url ?? null,
        variantCount: vs.length,
        minPricePaise: vs.length ? Math.min(...vs.map((v) => v.pricePaise)) : null,
        available: vs.reduce((n, v) => n + Math.max(0, (v.onHand ?? 0) - (v.reserved ?? 0)), 0),
      }
    }),
  }
}

export async function getProduct(tx: StoreTx, id: string) {
  const [p] = await tx.select().from(product).where(eq(product.id, id))
  if (!p) return null
  const variants = await tx
    .select({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      pricePaise: variant.pricePaise,
      mrpPaise: variant.mrpPaise,
      onHand: inventoryLevel.onHand,
    })
    .from(variant)
    .leftJoin(inventoryLevel, eq(inventoryLevel.variantId, variant.id))
    .where(eq(variant.productId, id))
    .orderBy(asc(variant.position))
  const images = await tx
    .select({ id: media.id, url: media.url, alt: media.alt })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(eq(productMedia.productId, id))
    .orderBy(asc(productMedia.position))
  return { ...p, variants, images }
}

export type ProductPatch = {
  title?: string | undefined
  handle?: string | undefined
  description?: string | null | undefined
  vendor?: string | null | undefined
  productType?: string | null | undefined
  status?: ProductStatus | undefined
}

export async function updateProduct(tx: StoreTx, id: string, patch: ProductPatch) {
  const set = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
  const [row] = await tx.update(product).set(set).where(eq(product.id, id)).returning()
  return row ?? null
}

export type VariantPatch = {
  pricePaise?: number | undefined
  mrpPaise?: number | null | undefined
  sku?: string | null | undefined
  onHand?: number | undefined
}

export async function updateVariant(tx: StoreTx, id: string, patch: VariantPatch) {
  const { onHand, ...rest } = patch
  const variantPatch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined))
  if (Object.keys(variantPatch).length > 0) {
    await tx.update(variant).set(variantPatch).where(eq(variant.id, id))
  }
  if (onHand !== undefined) {
    await tx.update(inventoryLevel).set({ onHand }).where(eq(inventoryLevel.variantId, id))
  }
  const [row] = await tx.select().from(variant).where(eq(variant.id, id))
  return row ?? null
}
