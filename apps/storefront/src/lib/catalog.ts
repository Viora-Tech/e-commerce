import type { CardProduct, ProductDetail } from '@commerce/blocks'
import type { StoreTx } from '@commerce/db'
import {
  inventoryLevel,
  media,
  product,
  productMedia,
  productOption,
  productOptionValue,
  sellableLevel,
  variant,
  variantOptionValue,
} from '@commerce/db'
import type { RichTextValue } from '@commerce/richtext'
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'

export type { CardProduct, ProductDetail }

/** Untracked variants are always purchasable; the cart still caps at what is on hand when tracked. */
function availableFor(v: {
  onHand: number | null
  reserved: number | null
  trackInventory: boolean
}): number {
  if (!v.trackInventory) return 999
  return Math.max(0, (v.onHand ?? 0) - (v.reserved ?? 0))
}

/** Products for cards: first two images, lowest price, summed availability. */
export async function listCardProducts(
  tx: StoreTx,
  limit = 48,
  productType?: string,
): Promise<CardProduct[]> {
  const products = await tx
    .select()
    .from(product)
    .where(
      and(
        eq(product.status, 'active'),
        productType ? eq(product.productType, productType) : undefined,
      ),
    )
    .orderBy(asc(product.title))
    .limit(limit)
  if (products.length === 0) return []
  const ids = products.map((p) => p.id)

  const variants = await tx
    .select({
      productId: variant.productId,
      pricePaise: variant.pricePaise,
      mrpPaise: variant.mrpPaise,
      onHand: inventoryLevel.onHand,
      reserved: inventoryLevel.reserved,
      trackInventory: variant.trackInventory,
    })
    .from(variant)
    .leftJoin(inventoryLevel, and(eq(inventoryLevel.variantId, variant.id), sellableLevel))
    .where(and(inArray(variant.productId, ids), isNull(variant.archivedAt)))

  const images = await tx
    .select({
      productId: productMedia.productId,
      url: media.url,
      alt: media.alt,
      position: productMedia.position,
    })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(and(inArray(productMedia.productId, ids), sql`${productMedia.position} < 2`))
    .orderBy(asc(productMedia.position))

  return products.map((p) => {
    const vs = variants.filter((v) => v.productId === p.id)
    const cheapest = vs.reduce<(typeof vs)[number] | null>(
      (m, v) => (m === null || v.pricePaise < m.pricePaise ? v : m),
      null,
    )
    return {
      id: p.id,
      handle: p.handle,
      title: p.title,
      vendor: p.vendor,
      productType: p.productType,
      pricePaise: cheapest?.pricePaise ?? 0,
      mrpPaise: cheapest?.mrpPaise ?? null,
      available: vs.reduce((n, v) => n + availableFor(v), 0),
      images: images.filter((i) => i.productId === p.id).map((i) => ({ url: i.url, alt: i.alt })),
    }
  })
}

export async function getProductByHandle(
  tx: StoreTx,
  handle: string,
): Promise<ProductDetail | null> {
  const [p] = await tx
    .select()
    .from(product)
    .where(and(eq(product.handle, handle), eq(product.status, 'active')))
  if (!p) return null

  const images = await tx
    .select({ url: media.url, alt: media.alt, contentType: media.contentType })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(eq(productMedia.productId, p.id))
    .orderBy(asc(productMedia.position))

  const options = await tx
    .select()
    .from(productOption)
    .where(eq(productOption.productId, p.id))
    .orderBy(asc(productOption.position))
  const optionIds = options.map((o) => o.id)
  const values =
    optionIds.length > 0
      ? await tx
          .select()
          .from(productOptionValue)
          .where(inArray(productOptionValue.optionId, optionIds))
          .orderBy(asc(productOptionValue.position))
      : []

  const vs = await tx
    .select({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      pricePaise: variant.pricePaise,
      mrpPaise: variant.mrpPaise,
      onHand: inventoryLevel.onHand,
      reserved: inventoryLevel.reserved,
      trackInventory: variant.trackInventory,
      imageUrl: media.url,
    })
    .from(variant)
    .leftJoin(inventoryLevel, and(eq(inventoryLevel.variantId, variant.id), sellableLevel))
    .leftJoin(media, eq(media.id, variant.mediaId))
    .where(and(eq(variant.productId, p.id), isNull(variant.archivedAt)))
    .orderBy(asc(variant.position))
  const vids = vs.map((v) => v.id)
  const links =
    vids.length > 0
      ? await tx
          .select()
          .from(variantOptionValue)
          .where(inArray(variantOptionValue.variantId, vids))
      : []

  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    description: p.description as RichTextValue | string | null,
    vendor: p.vendor,
    productType: p.productType,
    images,
    options: options.map((o) => ({
      id: o.id,
      name: o.name,
      values: values.filter((v) => v.optionId === o.id).map((v) => ({ id: v.id, value: v.value })),
    })),
    variants: vs.map((v) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      pricePaise: v.pricePaise,
      mrpPaise: v.mrpPaise,
      available: availableFor(v),
      optionValueIds: links.filter((l) => l.variantId === v.id).map((l) => l.optionValueId),
      imageUrl: v.imageUrl,
    })),
  }
}
