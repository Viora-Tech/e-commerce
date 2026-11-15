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
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { soldInRequestCatalog } from '../markets/catalog-rules'
import { type MarketPricing, presentmentCents } from '../markets/presentment'
import type { MediaVariants } from '../media/loader'
import { campaignApplies } from '../preorder/campaigns'
import { campaignsByIds } from '../preorder/campaigns-service'
import { resolvePreorderSettings } from '../preorder/settings'
import type { LiquidImageData, LiquidProductData } from './drops'
import { richTextHtml } from './rich-html'

/** Untracked variants are always purchasable; mirrors the storefront catalogue. */
const onHand = (v: { onHand: number | null; reserved: number | null; track: boolean }) =>
  v.track ? Math.max(0, (v.onHand ?? 0) - (v.reserved ?? 0)) : 999

/** Rows by key, each list in the rows' order. */
function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const row of rows) {
    const k = key(row)
    const list = out.get(k)
    if (list) list.push(row)
    else out.set(k, [row])
  }
  return out
}

/**
 * Products by id, fully loaded (variants, options, images), in the order given. Products the
 * market's catalog leaves out (Markets › Catalogs) are dropped, or with `keepUnsold` (the
 * product page) kept with no variant for sale.
 */
export async function loadProducts(
  tx: StoreTx,
  ids: string[],
  /** The page's market: prices in its currency (`presentmentCents`); null keeps rupees. */
  pricing: MarketPricing | null = null,
  options: { keepUnsold?: boolean } = {},
): Promise<LiquidProductData[]> {
  if (ids.length === 0) return []
  const [found, variants, images, optionRows, memberships] = await Promise.all([
    tx
      .select({ p: product, soldHere: sql<boolean>`${soldInRequestCatalog(product.id)}` })
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
        imageVariants: media.variants,
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
        variants: media.variants,
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
  // Pre-order campaigns (Products › Pre-orders) that sell on the online store now, as the
  // product page reads them (`storefrontCampaigns`): a product in one sells on pre-order even
  // with its own switch off.
  const campaigns = await campaignsByIds(
    tx,
    found.map((r) => r.p.preorderCampaignId),
  )
  const campaignOf = (p: (typeof found)[number]['p']) => {
    const c = p.preorderCampaignId ? campaigns.get(p.preorderCampaignId) : undefined
    return c && campaignApplies(c, { marketId: undefined, channel: 'online_store' }) ? c : null
  }
  const unsold = new Set(found.filter((r) => !r.soldHere).map((r) => r.p.id))
  const rows = found.filter((r) => options.keepUnsold || r.soldHere).map((r) => r.p)
  const byId = new Map(rows.map((r) => [r.id, r]))
  // Rows grouped once by their product or variant, in query order: a page asks for a few
  // hundred products, and filtering every row list per product and per variant was quadratic.
  const optionsOf = groupBy(optionRows, (o) => o.productId)
  const imagesOf = groupBy(images, (i) => i.productId)
  const variantsOf = groupBy(variants, (v) => v.productId)
  const valuesOf = groupBy(values, (x) => x.variantId)
  const variantImagesOf = groupBy(variantImages, (r) => r.variantId)
  const membershipsOf = groupBy(memberships, (m) => m.productId)
  return ids.flatMap((id) => {
    const p = byId.get(id)
    if (!p) return []
    const opts = new Map<string, string[]>()
    for (const o of optionsOf.get(id) ?? []) {
      const list = opts.get(o.name) ?? []
      if (o.value && !list.includes(o.value)) list.push(o.value)
      opts.set(o.name, list)
    }
    const productImages = imagesOf.get(id) ?? []
    const imgs: LiquidImageData[] = productImages
      .filter((i) => (i.contentType ?? 'image/').startsWith('image/'))
      .map((i) => ({
        id: i.id,
        url: i.url,
        alt: i.alt ?? p.title,
        width: i.width,
        height: i.height,
        variants: i.variants as MediaVariants,
      }))
    const productVariants = variantsOf.get(id) ?? []
    const optionValuesOf = (v: (typeof variants)[number]) =>
      (valuesOf.get(v.id) ?? []).map((x) => x.value)
    // A value only hidden variants use (#934) is not offered; a product whose variants carry no
    // option values keeps its options as they are.
    const variantValues = new Set(productVariants.flatMap(optionValuesOf))
    const anyValues = productVariants.some((v) => valuesOf.has(v.id))
    const shownValue = (value: string) =>
      variantValues.has(value) || (!anyValues && productVariants.length > 0)
    const listOf = (v: (typeof variants)[number]) => {
      const listed = (variantImagesOf.get(v.id) ?? []).map((r) => r.mediaId)
      return listed.length ? listed : v.mediaId ? [v.mediaId] : []
    }
    const lists = new Map(productVariants.map((v) => [v.id, listOf(v)]))
    // Themes that group gallery images by variant read `media.alt` as the option value
    // (Shopify's "alt = colour" convention); an image with no alt of its own gets the value
    // its variants share, else the product title.
    const groupAlt = new Map<string, string>()
    for (const img of imgs) {
      if (productImages.find((i) => i.id === img.id)?.alt) continue
      const owners = productVariants.filter((v) => lists.get(v.id)?.includes(img.id as string))
      const opts = owners.map(optionValuesOf)
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
    const campaign = campaignOf(p)
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
        preorder: resolvePreorderSettings(p, null, campaign).enabled,
        collectionHandles: (membershipsOf.get(id) ?? []).map((m) => m.handle),
        variants: productVariants.map((v) => {
          const qty = onHand(v)
          // Pre-order variants sell with no stock, as Shopify's "continue selling" does: the
          // product (or its campaign) has pre-order on and the variant allows it (#962), else
          // sold out, which the theme draws crossed out.
          const preorder = resolvePreorderSettings(p, v.preorder, campaign).enabled
          // Listed without a price (#913): Liquid needs a number, and the variant is not for sale.
          const price = v.price
          return {
            id: v.id,
            title: v.title,
            // A catalog's fixed price for the variant wins (Markets › Catalogs).
            price: price == null ? 0 : presentmentCents(price, pricing, v.id),
            compareAtPrice:
              price != null && v.mrp && v.mrp > price ? presentmentCents(v.mrp, pricing) : null,
            available: !unsold.has(p.id) && price != null && (qty > 0 || preorder),
            inventoryQuantity: qty,
            preorder,
            sku: v.sku,
            barcode: v.barcode,
            weightGrams: v.weight,
            options: optionValuesOf(v),
            image: v.imageUrl
              ? (imageById.get(v.mediaId ?? '') ?? {
                  id: v.mediaId ?? undefined,
                  url: v.imageUrl,
                  alt: p.title,
                  variants: v.imageVariants as MediaVariants,
                })
              : null,
            media: (lists.get(v.id) ?? []).flatMap((mediaId) => imageById.get(mediaId) ?? []),
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
 * Several collections' active product ids and handles in their own order, the first `limit` of
 * each (`all` is every product A to Z by title, the order Shopify's `collections.all` reads in).
 * A handle that names no collection gets an empty list.
 */
async function collectionMembers(
  tx: StoreTx,
  handles: string[],
  limit: number,
): Promise<Map<string, { id: string; handle: string }[]>> {
  const named = handles.filter((h) => h !== 'all')
  const rows = named.length
    ? await tx
        .select({ id: product.id, productHandle: product.handle, handle: collection.handle })
        .from(collectionProduct)
        .innerJoin(collection, eq(collection.id, collectionProduct.collectionId))
        .innerJoin(product, eq(product.id, collectionProduct.productId))
        .where(
          and(
            inArray(collection.handle, named),
            eq(product.status, 'active'),
            soldInRequestCatalog(product.id),
          ),
        )
        .orderBy(asc(collection.handle), asc(collectionProduct.position))
    : []
  const members = new Map<string, { id: string; handle: string }[]>()
  for (const r of rows) {
    const list = members.get(r.handle) ?? []
    if (list.length < limit) list.push({ id: r.id, handle: r.productHandle })
    members.set(r.handle, list)
  }
  const all = handles.includes('all')
    ? await tx
        .select({ id: product.id, handle: product.handle })
        .from(product)
        .where(and(eq(product.status, 'active'), soldInRequestCatalog(product.id)))
        .orderBy(asc(product.title), asc(product.id))
        .limit(limit)
    : []
  if (all.length) members.set('all', all)
  return members
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
  const members = await collectionMembers(tx, handles, limit)
  const ids = [...new Set([...members.values()].flat().map((m) => m.id))]
  const loaded = await loadProducts(tx, ids, pricing)
  const byId = new Map(loaded.map((p) => [p.id, p]))
  const out = new Map<string, LiquidProductData[]>()
  for (const handle of handles) {
    out.set(
      handle,
      (members.get(handle) ?? []).flatMap((m) => byId.get(m.id) ?? []),
    )
  }
  return out
}

/**
 * The same collections' product handles only (`collectionsProducts` without loading the
 * products), so a theme that reads three products of a collection loads three.
 */
export async function collectionsProductHandles(
  tx: StoreTx,
  handles: string[],
  limit: number,
): Promise<Map<string, string[]>> {
  const members = await collectionMembers(tx, handles, limit)
  return new Map(handles.map((h) => [h, (members.get(h) ?? []).map((m) => m.handle)]))
}

/**
 * Every active collection A to Z with its image and live product count (active, sold in the
 * request's catalog). The counts come from one grouped pass, left-joined; a correlated count per
 * collection scanned the products once per collection.
 */
export function activeCollectionRows(tx: StoreTx) {
  const counts = tx
    .select({ collectionId: collectionProduct.collectionId, n: sql<number>`count(*)`.as('n') })
    .from(collectionProduct)
    .innerJoin(product, eq(product.id, collectionProduct.productId))
    .where(and(eq(product.status, 'active'), soldInRequestCatalog(product.id)))
    .groupBy(collectionProduct.collectionId)
    .as('counts')
  return tx
    .select({
      id: collection.id,
      handle: collection.handle,
      title: collection.title,
      description: collection.description,
      imageUrl: media.url,
      imageAlt: media.alt,
      imageVariants: media.variants,
      width: media.width,
      height: media.height,
      count: sql<number>`coalesce(${counts.n}, 0)`,
    })
    .from(collection)
    .leftJoin(media, eq(media.id, collection.imageMediaId))
    .leftJoin(counts, eq(counts.collectionId, collection.id))
    .where(eq(collection.status, 'active'))
    .orderBy(asc(collection.title))
}
