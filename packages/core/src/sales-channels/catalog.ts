/** SOURCE OF TRUTH: sales channel catalog — WHAT: one item per sellable variant for Meta, Google and OpenAI / WHY: one feed shape for every channel */
/**
 * The catalog a sales channel receives: one item per sellable variant of every live product,
 * in the fields Meta, Google and OpenAI share (id, title, description, link, image, price,
 * availability, brand, GTIN). AI agents see only what Agentic sales → Controls leaves visible;
 * social channels see every live product.
 */
import { createHash } from 'node:crypto'
import {
  collectionProduct,
  inventoryLevel,
  media,
  product,
  productMedia,
  type StoreTx,
  sellableLevel,
  store,
  variant,
} from '@commerce/db'
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { notSystemTest } from '../catalog/system-test'
import { seoBodyText } from '../seo/checks'
import type { AgentControls } from './client'

export type ChannelItem = {
  /** Our variant id: stable, and what the platform keys the item by. */
  id: string
  /** The product id, so platforms group variants of one product. */
  groupId: string
  title: string
  description: string
  link: string
  imageLink: string | null
  additionalImages: string[]
  pricePaise: number
  /** The MRP when the price is below it (shown struck out). */
  mrpPaise: number | null
  availability: 'in_stock' | 'out_of_stock'
  quantity: number | null
  brand: string
  gtin: string | null
  sku: string | null
}

/** Platforms cap descriptions; 5,000 characters is Google's and Meta's limit. */
const DESCRIPTION_MAX = 5000
/** A sync sends at most this many items; more is a catalog for the full feed APIs, not this. */
const CATALOG_MAX_ITEMS = 10_000

const absolute = (url: string, origin: string) =>
  /^https?:\/\//i.test(url) ? url : `${origin.replace(/\/$/, '')}/${url.replace(/^\//, '')}`

/** What changed in an item since the last sync. */
export const itemHash = (item: ChannelItem): string =>
  createHash('sha256').update(JSON.stringify(item)).digest('base64url').slice(0, 22)

export async function buildChannelCatalog(
  tx: StoreTx,
  storeId: string,
  opts: { origin: string; agents?: AgentControls | undefined },
): Promise<ChannelItem[]> {
  const [s] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
  const controls = opts.agents
  const where = [eq(product.status, 'active'), notSystemTest, eq(product.isGiftCard, false)]
  if (controls?.hideTagged && controls.hiddenTags.length)
    where.push(sql`not (${product.tags} && ${sql.param(controls.hiddenTags)}::text[])`)
  if (controls?.visibility === 'collections') {
    if (!controls.collectionIds.length) return []
    where.push(
      sql`exists (select 1 from ${collectionProduct} where ${collectionProduct.productId} = ${product.id} and ${collectionProduct.collectionId} = any(${sql.param(controls.collectionIds)}::uuid[]))`,
    )
  }
  const products = await tx
    .select({
      id: product.id,
      handle: product.handle,
      title: product.title,
      description: product.description,
      seoDescription: product.seoDescription,
      vendor: product.vendor,
    })
    .from(product)
    .where(and(...where))
    .orderBy(asc(product.title))
    .limit(CATALOG_MAX_ITEMS)
  if (!products.length) return []
  const ids = products.map((p) => p.id)

  const [variants, images, stock] = await Promise.all([
    tx
      .select({
        id: variant.id,
        productId: variant.productId,
        title: variant.title,
        pricePaise: variant.pricePaise,
        mrpPaise: variant.mrpPaise,
        barcode: variant.barcode,
        sku: variant.sku,
        trackInventory: variant.trackInventory,
        imageUrl: media.url,
      })
      .from(variant)
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
      .select({ productId: productMedia.productId, url: media.url })
      .from(productMedia)
      .innerJoin(media, eq(media.id, productMedia.mediaId))
      .where(inArray(productMedia.productId, ids))
      .orderBy(asc(productMedia.position)),
    tx
      .select({
        variantId: inventoryLevel.variantId,
        available: sql<number>`coalesce(sum(${inventoryLevel.onHand} - ${inventoryLevel.reserved}), 0)::int`,
      })
      .from(inventoryLevel)
      .where(sellableLevel)
      .groupBy(inventoryLevel.variantId),
  ])

  const imagesOf = new Map<string, string[]>()
  for (const i of images) {
    const list = imagesOf.get(i.productId) ?? []
    list.push(absolute(i.url, opts.origin))
    imagesOf.set(i.productId, list)
  }
  const available = new Map(stock.map((r) => [r.variantId, r.available]))
  const byProduct = new Map(products.map((p) => [p.id, p]))

  const items: ChannelItem[] = []
  for (const v of variants) {
    const p = byProduct.get(v.productId)
    // Feeds need a price, so a variant listed without one (#913) stays out until it has one.
    if (!p || v.pricePaise == null) continue
    const gallery = imagesOf.get(p.id) ?? []
    const own = v.imageUrl ? absolute(v.imageUrl, opts.origin) : null
    const qty = v.trackInventory ? Math.max(0, available.get(v.id) ?? 0) : null
    const single = variants.filter((x) => x.productId === p.id).length === 1
    const body = seoBodyText(p.description) || p.seoDescription || p.title
    items.push({
      id: v.id,
      groupId: p.id,
      title: (single || v.title === 'Default' ? p.title : `${p.title} - ${v.title}`).slice(0, 150),
      description: body.slice(0, DESCRIPTION_MAX),
      link: `${opts.origin.replace(/\/$/, '')}/products/${p.handle}${single ? '' : `?variant=${v.id}`}`,
      imageLink: own ?? gallery[0] ?? null,
      additionalImages: gallery.filter((g) => g !== own).slice(0, 10),
      pricePaise: v.pricePaise,
      mrpPaise: v.mrpPaise && v.mrpPaise > v.pricePaise ? v.mrpPaise : null,
      availability: qty === null || qty > 0 ? 'in_stock' : 'out_of_stock',
      quantity: qty,
      brand: p.vendor?.trim() || s?.name || '',
      gtin: v.barcode?.trim() || null,
      sku: v.sku?.trim() || null,
    })
  }
  return items
}

/** "1999.00 INR": the price format Meta and OpenAI read. */
export const priceText = (paise: number, currency = 'INR') =>
  `${(paise / 100).toFixed(2)} ${currency}`
