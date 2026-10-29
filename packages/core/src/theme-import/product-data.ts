/** SOURCE OF TRUTH: products for imported themes — WHAT: products fully loaded for Liquid (variants with stock, options, images), by id, by handle in one batch, and several collections' products in one batch / WHY: a theme page asks for dozens of products and collections; loading each on its own cost five queries apiece, so `cache.ts` batches what one render pass asks for and these answer it in a handful of queries */
import {
  collection,
  collectionProduct,
  media,
  product,
  productMedia,
  productOption,
  productOptionValue,
  type StoreTx,
  sellableStock,
  variant,
  variantMedia,
  variantOptionValue,
} from '@commerce/db'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { type MarketPricing, presentmentCents } from '../markets/presentment'
import { variantAllowsPreorder } from '../preorder/settings'
import type { LiquidImageData, LiquidProductData } from './drops'
import { richTextHtml } from './rich-html'

/** Untracked variants are always purchasable; mirrors the storefront catalogue. */
const onHand = (v: { onHand: number | null; reserved: number | null; track: boolean }) =>
  v.track ? Math.max(0, (v.onHand ?? 0) - (v.reserved ?? 0)) : 999

/** Products by id, fully loaded (variants, options, images), in the order given. */
export async function loadProducts(
  tx: StoreTx,
  ids: string[],
  /** The page's market: prices in its currency (`presentmentCents`); null keeps rupees. */
  pricing: MarketPricing | null = null,
): Promise<LiquidProductData[]> {
  if (ids.length === 0) return []
  const [rows, variants, images, options, memberships] = await Promise.all([
    tx
      .select()
      .from(product)
      .where(and(inArray(product.id, ids), eq(product.status, 'active'))),
    tx
      .select({
        id: variant.id,
        productId: variant.productId,
        title: variant.title,
        price: variant.pricePaise,
        mrp: variant.mrpPaise,
        sku: variant.sku,
        barcode: variant.barcode,
        weight: variant.weightGrams,
        track: variant.trackInventory,
        onHand: sellableStock.onHand,
        reserved: sellableStock.reserved,
        mediaId: variant.mediaId,
        imageUrl: media.url,
        position: variant.position,
        preorder: variant.preorderOverride,
      })
      .from(variant)
      .leftJoin(sellableStock, eq(sellableStock.variantId, variant.id))
      .leftJoin(media, eq(media.id, variant.mediaId))
      .where(
        and(
          inArray(variant.productId, ids),
          isNull(variant.archivedAt),
          eq(variant.hiddenOnStore, false),
        ),
      )
      .orderBy(asc(variant.position)),
    tx
      .select({
        productId: productMedia.productId,
        id: media.id,
        url: media.url,
        alt: media.alt,
        width: media.width,
        height: media.height,
        contentType: media.contentType,
      })
      .from(productMedia)
      .innerJoin(media, eq(media.id, productMedia.mediaId))
      .where(inArray(productMedia.productId, ids))
      .orderBy(asc(productMedia.position)),
    tx
      .select({
        productId: productOption.productId,
        name: productOption.name,
        position: productOption.position,
        value: productOptionValue.value,
        valuePosition: productOptionValue.position,
      })
      .from(productOption)
      .leftJoin(productOptionValue, eq(productOptionValue.optionId, productOption.id))
      .where(inArray(productOption.productId, ids))
      .orderBy(asc(productOption.position), asc(productOptionValue.position)),
    tx
      .select({ productId: collectionProduct.productId, handle: collection.handle })
      .from(collectionProduct)
      .innerJoin(collection, eq(collection.id, collectionProduct.collectionId))
      .where(and(inArray(collectionProduct.productId, ids), eq(collection.status, 'active')))
      .orderBy(asc(collection.title)),
  ])
  const variantIds = variants.map((v) => v.id)
  // Each variant's own images in order (first = `variant.featured_media`).
  const variantImages = variantIds.length
    ? await tx
        .select({ variantId: variantMedia.variantId, mediaId: variantMedia.mediaId })
        .from(variantMedia)
        .where(inArray(variantMedia.variantId, variantIds))
        .orderBy(asc(variantMedia.position))
    : []
  const values = variantIds.length
    ? await tx
        .select({
          variantId: variantOptionValue.variantId,
          value: productOptionValue.value,
          position: productOption.position,
        })
        .from(variantOptionValue)
        .innerJoin(productOptionValue, eq(productOptionValue.id, variantOptionValue.optionValueId))
        .innerJoin(productOption, eq(productOption.id, productOptionValue.optionId))
        .where(inArray(variantOptionValue.variantId, variantIds))
        .orderBy(asc(productOption.position))
    : []
  const byId = new Map(rows.map((r) => [r.id, r]))
  return ids.flatMap((id) => {
    const p = byId.get(id)
    if (!p) return []
    const opts = new Map<string, string[]>()
    for (const o of options.filter((x) => x.productId === id)) {
      const list = opts.get(o.name) ?? []
      if (o.value && !list.includes(o.value)) list.push(o.value)
      opts.set(o.name, list)
    }
    const imgs: LiquidImageData[] = images
      .filter((i) => i.productId === id && (i.contentType ?? 'image/').startsWith('image/'))
      .map((i) => ({
        id: i.id,
        url: i.url,
        alt: i.alt ?? p.title,
        width: i.width,
        height: i.height,
      }))
    const productVariants = variants.filter((v) => v.productId === id)
    // A value only hidden variants use (#934) is not offered; a product whose variants carry no
    // option values keeps its options as they are.
    const variantValues = values.filter((x) => productVariants.some((v) => v.id === x.variantId))
    const shownValue = (value: string) =>
      variantValues.some((x) => x.value === value) ||
      (variantValues.length === 0 && productVariants.length > 0)
    const listOf = (v: (typeof variants)[number]) => {
      const listed = variantImages.filter((r) => r.variantId === v.id).map((r) => r.mediaId)
      return listed.length ? listed : v.mediaId ? [v.mediaId] : []
    }
    // Themes that group gallery images by variant read `media.alt` as the option value
    // (Shopify's "alt = colour" convention); an image with no alt of its own gets the value
    // its variants share, else the product title.
    const groupAlt = new Map<string, string>()
    for (const img of imgs) {
      if (images.find((i) => i.id === img.id && i.productId === id)?.alt) continue
      const owners = productVariants.filter((v) => listOf(v).includes(img.id as string))
      const opts = owners.map((v) => values.filter((x) => x.variantId === v.id).map((x) => x.value))
      const first = opts[0]
      const shared = first?.find((value, i) => opts.every((o) => o[i] === value))
      if (shared) groupAlt.set(img.id as string, shared)
    }
    for (const img of imgs) {
      const alt = groupAlt.get(img.id as string)
      if (alt) img.alt = alt
    }
    const imageById = new Map(imgs.map((i) => [i.id as string, i]))
    const description = richTextHtml(p.description)
    return [
      {
        id: p.id,
        handle: p.handle,
        title: p.title,
        descriptionHtml: description,
        vendor: p.vendor ?? '',
        type: p.productType ?? '',
        tags: p.tags,
        images: imgs,
        options: [...opts]
          .map(([name, vals]) => ({ name, values: vals.filter(shownValue) }))
          .filter((o) => o.values.length > 0),
        createdAt: p.createdAt,
        preorder: p.preorderEnabled,
        collectionHandles: memberships.filter((m) => m.productId === id).map((m) => m.handle),
        variants: productVariants.map((v) => {
          const qty = onHand(v)
          // Pre-order variants sell with no stock, as Shopify's "continue selling" does: the
          // product has pre-order on and the variant allows it (#962), else sold out, which the
          // theme draws crossed out.
          const preorder = p.preorderEnabled && variantAllowsPreorder(v.preorder)
          // Listed without a price (#913): Liquid needs a number, and the variant is not for sale.
          const price = v.price
          return {
            id: v.id,
            title: v.title,
            price: price == null ? 0 : presentmentCents(price, pricing),
            compareAtPrice:
              price != null && v.mrp && v.mrp > price ? presentmentCents(v.mrp, pricing) : null,
            available: price != null && (qty > 0 || preorder),
            inventoryQuantity: qty,
            preorder,
            sku: v.sku,
            barcode: v.barcode,
            weightGrams: v.weight,
            options: values.filter((x) => x.variantId === v.id).map((x) => x.value),
            image: v.imageUrl
              ? (imageById.get(v.mediaId ?? '') ?? {
                  id: v.mediaId ?? undefined,
                  url: v.imageUrl,
                  alt: p.title,
                })
              : null,
            media: listOf(v).flatMap((mediaId) => imageById.get(mediaId) ?? []),
          }
        }),
      },
    ]
  })
}

/** Active products by handle, in one load; a handle that names none is left out. */
export async function productsByHandles(
  tx: StoreTx,
  handles: string[],
  pricing: MarketPricing | null = null,
): Promise<Map<string, LiquidProductData>> {
  if (handles.length === 0) return new Map()
  const rows = await tx
    .select({ id: product.id })
    .from(product)
    .where(and(inArray(product.handle, handles), eq(product.status, 'active')))
  const loaded = await loadProducts(
    tx,
    rows.map((r) => r.id),
    pricing,
  )
  return new Map(loaded.map((p) => [p.handle, p]))
}

/**
 * Several collections' active products in their own order, the first `limit` of each, in one
 * load (`all` is every product A to Z by title, the order Shopify's `collections.all` reads in). A handle that names no collection gets an empty list.
 */
export async function collectionsProducts(
  tx: StoreTx,
  handles: string[],
  limit: number,
  pricing: MarketPricing | null = null,
): Promise<Map<string, LiquidProductData[]>> {
  const out = new Map<string, LiquidProductData[]>()
  const named = handles.filter((h) => h !== 'all')
  const rows = named.length
    ? await tx
        .select({ id: product.id, handle: collection.handle })
        .from(collectionProduct)
        .innerJoin(collection, eq(collection.id, collectionProduct.collectionId))
        .innerJoin(product, eq(product.id, collectionProduct.productId))
        .where(and(inArray(collection.handle, named), eq(product.status, 'active')))
        .orderBy(asc(collection.handle), asc(collectionProduct.position))
    : []
  const ids = new Map<string, string[]>()
  for (const r of rows) {
    const list = ids.get(r.handle) ?? []
    if (list.length < limit) list.push(r.id)
    ids.set(r.handle, list)
  }
  const all = handles.includes('all')
    ? await tx
        .select({ id: product.id })
        .from(product)
        .where(eq(product.status, 'active'))
        .orderBy(asc(product.title), asc(product.id))
        .limit(limit)
    : []
  if (all.length)
    ids.set(
      'all',
      all.map((r) => r.id),
    )
  const loaded = await loadProducts(tx, [...new Set([...ids.values()].flat())], pricing)
  const byId = new Map(loaded.map((p) => [p.id, p]))
  for (const handle of handles) {
    out.set(
      handle,
      (ids.get(handle) ?? []).flatMap((id) => byId.get(id) ?? []),
    )
  }
  return out
}
