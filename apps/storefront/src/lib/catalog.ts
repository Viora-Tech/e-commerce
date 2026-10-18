import 'server-only'
import type { CardProduct, ProductDetail } from '@commerce/blocks'
import {
  computeDepositFromSettings,
  depositPreview,
  isLaunched,
  resolvePreorderSettings,
  resolveShipDate,
} from '@commerce/core/preorder'
import type { StoreTx } from '@commerce/db'
import {
  media,
  product,
  productMedia,
  productOption,
  productOptionValue,
  sellableStock,
  variant,
  variantOptionValue,
} from '@commerce/db'
import { review } from '@commerce/plugin-reviews/schema'
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

/** Average stars and count of published reviews per product (Reviews app), for the cards. */
export async function cardRatings(
  tx: StoreTx,
  ids: string[],
): Promise<Map<string, { average: number; count: number }>> {
  if (!ids.length) return new Map()
  const rows = await tx
    .select({
      productId: review.productId,
      average: sql<number>`avg(${review.rating})::float`,
      count: sql<number>`count(*)::int`,
    })
    .from(review)
    .where(and(inArray(review.productId, ids), eq(review.status, 'published')))
    .groupBy(review.productId)
  return new Map(rows.map((r) => [r.productId, { average: r.average, count: r.count }]))
}

/** Products for cards: first two images, lowest price, summed availability. */
export async function listCardProducts(
  tx: StoreTx,
  limit = 48,
  productType?: string,
  /** Only these products, in this order (featured product, recently viewed). */
  handles?: string[],
): Promise<CardProduct[]> {
  if (handles?.length === 0) return []
  const found = await tx
    .select()
    .from(product)
    .where(
      and(
        eq(product.status, 'active'),
        productType ? eq(product.productType, productType) : undefined,
        handles ? inArray(product.handle, handles) : undefined,
      ),
    )
    .orderBy(asc(product.title))
    .limit(limit)
  const products = handles ? handles.flatMap((h) => found.filter((p) => p.handle === h)) : found
  if (products.length === 0) return []
  const ids = products.map((p) => p.id)

  const variants = await tx
    .select({
      id: variant.id,
      productId: variant.productId,
      pricePaise: variant.pricePaise,
      mrpPaise: variant.mrpPaise,
      onHand: sellableStock.onHand,
      reserved: sellableStock.reserved,
      trackInventory: variant.trackInventory,
    })
    .from(variant)
    .leftJoin(sellableStock, eq(sellableStock.variantId, variant.id))
    .where(and(inArray(variant.productId, ids), isNull(variant.archivedAt)))

  const images = await tx
    .select({
      productId: productMedia.productId,
      url: media.url,
      alt: media.alt,
      position: productMedia.position,
      variants: media.variants,
      thumbhash: media.thumbhash,
    })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(and(inArray(productMedia.productId, ids), sql`${productMedia.position} < 2`))
    .orderBy(asc(productMedia.position))
  const ratings = await cardRatings(tx, ids)

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
      // Quick add needs no choice only when there is one variant to add.
      quickAddVariantId: vs.length === 1 ? (vs[0]?.id ?? null) : null,
      rating: ratings.get(p.id) ?? null,
      images: images
        .filter((i) => i.productId === p.id)
        .map((i) => ({
          url: i.url,
          alt: i.alt,
          variants: i.variants as Record<string, { avif: string; webp: string }> | null,
          thumbhash: i.thumbhash,
        })),
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
  const launched = isLaunched(p.launchAt)

  const imageRows = await tx
    .select({
      url: media.url,
      alt: media.alt,
      contentType: media.contentType,
      variants: media.variants,
      thumbhash: media.thumbhash,
    })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(eq(productMedia.productId, p.id))
    .orderBy(asc(productMedia.position))
  // Variants and ThumbHash let the gallery serve AVIF/WebP at the width it needs:
  // the first image is the product page's LCP element.
  const images = imageRows.map((i) => ({
    ...i,
    variants: i.variants as Record<string, { avif: string; webp: string }> | null,
  }))

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
      onHand: sellableStock.onHand,
      reserved: sellableStock.reserved,
      trackInventory: variant.trackInventory,
      imageUrl: media.url,
      preorderOverride: variant.preorderOverride,
    })
    .from(variant)
    .leftJoin(sellableStock, eq(sellableStock.variantId, variant.id))
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

  // A variant is purchasable "beyond stock" while pre-order is on and its
  // already-committed pre-order units (reserved beyond on_hand) haven't hit
  // the limit; see reserveStock in @commerce/core/order/place-order for the
  // matching server-side check this only previews.
  const purchasableFor = (v: (typeof vs)[number]): boolean => {
    if (!launched) return false
    const stockAvailable = availableFor(v)
    if (stockAvailable > 0) return true
    const settings = resolvePreorderSettings(p, v.preorderOverride)
    if (!settings.enabled) return false
    if (settings.limit == null) return true
    const committed = Math.max(0, (v.reserved ?? 0) - (v.onHand ?? 0))
    return committed < settings.limit
  }

  const firstVariant = vs.find((v) => purchasableFor(v)) ?? vs[0]
  const preorderSettings = firstVariant
    ? resolvePreorderSettings(p, firstVariant.preorderOverride)
    : resolvePreorderSettings(p)
  const shipDate = preorderSettings.enabled ? resolveShipDate(preorderSettings) : null

  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    description: p.description as RichTextValue | string | null,
    vendor: p.vendor,
    productType: p.productType,
    images,
    templateSuffix: p.templateSuffix,
    launchAt: p.launchAt ? p.launchAt.toISOString() : null,
    preorder: preorderSettings.enabled
      ? {
          enabled: true,
          buttonLabel: preorderSettings.buttonLabel,
          shipDate: shipDate ? shipDate.toISOString() : null,
          depositPreview:
            firstVariant && preorderSettings.paymentMode !== 'full'
              ? depositPreview(
                  computeDepositFromSettings(firstVariant.pricePaise, preorderSettings),
                )
              : null,
        }
      : null,
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
      purchasable: purchasableFor(v),
      optionValueIds: links.filter((l) => l.variantId === v.id).map((l) => l.optionValueId),
      imageUrl: v.imageUrl,
    })),
  }
}

/** The merchant's search listing overrides for a product; blank means "use the product's own". */
export async function getProductSeo(
  tx: StoreTx,
  productId: string,
): Promise<{ seoTitle: string | null; seoDescription: string | null } | null> {
  const [row] = await tx
    .select({ seoTitle: product.seoTitle, seoDescription: product.seoDescription })
    .from(product)
    .where(eq(product.id, productId))
  return row ?? null
}
