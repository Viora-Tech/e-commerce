/** SOURCE OF TRUTH: the store data an imported theme reads — WHAT: a per-request `LiquidDataSource` over our database (products with variants, options and images; collections and their products; menus; blogs; pages; the shop), cached within the request / WHY: imported Liquid asks for Shopify objects by handle; this answers from our catalogue under the store's RLS, so the theme shows our live data */
import {
  article,
  blog,
  collection,
  collectionProduct,
  inventoryLevel,
  media,
  navigationMenu,
  page,
  product,
  productMedia,
  productOption,
  productOptionValue,
  type StoreTx,
  sellableLevel,
  store,
  variant,
  variantOptionValue,
} from '@commerce/db'
import { and, asc, desc, eq, inArray, isNotNull, isNull, like, sql } from 'drizzle-orm'
import { toNavLinks } from '../navigation/resolve'
import { uuidPrefixOf } from './numeric-id'
import { richTextHtml } from './rich-html'
import type {
  LiquidBlogData,
  LiquidCartData,
  LiquidCollectionData,
  LiquidDataSource,
  LiquidImageData,
  LiquidLinkData,
  LiquidProductData,
  LiquidShopData,
} from './drops'

export type StoreLiquidDataOptions = {
  storeId: string
  /** The host shoppers use (`waimers.in`), for `shop.url`. */
  host: string
  origin: string
  /** The shopper's cart, from the storefront cart cookie; empty in the editor. */
  cart?: (() => Promise<LiquidCartData>) | undefined
}

const EMPTY_CART: LiquidCartData = { itemCount: 0, totalPrice: 0, items: [] }

/** Untracked variants are always purchasable; mirrors the storefront catalogue. */
const onHand = (v: { onHand: number | null; reserved: number | null; track: boolean }) =>
  v.track ? Math.max(0, (v.onHand ?? 0) - (v.reserved ?? 0)) : 999

const toHtml = richTextHtml

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Products by id, fully loaded (variants, options, images), in the order given. */
async function loadProducts(tx: StoreTx, ids: string[]): Promise<LiquidProductData[]> {
  if (ids.length === 0) return []
  const [rows, variants, images, options] = await Promise.all([
    tx.select().from(product).where(and(inArray(product.id, ids), eq(product.status, 'active'))),
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
        onHand: inventoryLevel.onHand,
        reserved: inventoryLevel.reserved,
        imageUrl: media.url,
        position: variant.position,
        preorder: variant.preorderOverride,
      })
      .from(variant)
      .leftJoin(inventoryLevel, and(eq(inventoryLevel.variantId, variant.id), sellableLevel))
      .leftJoin(media, eq(media.id, variant.mediaId))
      .where(and(inArray(variant.productId, ids), isNull(variant.archivedAt)))
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
  ])
  const variantIds = variants.map((v) => v.id)
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
      .map((i) => ({ id: i.id, url: i.url, alt: i.alt ?? p.title, width: i.width, height: i.height }))
    const description = toHtml(p.description)
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
        options: [...opts].map(([name, vals]) => ({ name, values: vals })),
        createdAt: p.createdAt,
        preorder: p.preorderEnabled,
        variants: variants
          .filter((v) => v.productId === id)
          .map((v) => {
            const qty = onHand(v)
            // Pre-order variants sell with no stock, as Shopify's "continue selling" does.
            const preorder = v.preorder?.enabled ?? p.preorderEnabled
            return {
              id: v.id,
              title: v.title,
              price: v.price,
              compareAtPrice: v.mrp && v.mrp > v.price ? v.mrp : null,
              available: qty > 0 || preorder,
              inventoryQuantity: qty,
              sku: v.sku,
              barcode: v.barcode,
              weightGrams: v.weight,
              options: values.filter((x) => x.variantId === v.id).map((x) => x.value),
              image: v.imageUrl ? { url: v.imageUrl, alt: p.title } : null,
            }
          }),
      },
    ]
  })
}

/** Our menu items as Shopify links, three levels deep. */
function toLinks(links: ReturnType<typeof toNavLinks>): LiquidLinkData[] {
  return links.map((l) => ({
    title: l.label,
    url: l.href,
    type: l.href.startsWith('/collections/')
      ? 'collection_link'
      : l.href.startsWith('/products/')
        ? 'product_link'
        : l.href.startsWith('/pages/')
          ? 'page_link'
          : l.href === '/'
            ? 'frontpage_link'
            : 'http_link',
    links: toLinks(l.children ?? []),
  }))
}

/**
 * The data source for one request. Every lookup is memoised for the request, so
 * a product shown in three sections is read once.
 */
export async function storeLiquidData(
  tx: StoreTx,
  options: StoreLiquidDataOptions,
): Promise<LiquidDataSource> {
  const memo = new Map<string, Promise<unknown>>()
  const once = <T>(key: string, load: () => Promise<T>): Promise<T> => {
    const hit = memo.get(key)
    if (hit) return hit as Promise<T>
    const next = load()
    memo.set(key, next)
    return next
  }

  const [s] = await tx
    .select({
      name: store.name,
      email: store.contactEmail,
      phone: store.contactPhone,
      preferences: store.preferences,
    })
    .from(store)
    .where(eq(store.id, options.storeId))
  const seo = ((s?.preferences as { seo?: { description?: string } } | null)?.seo ?? {}) as {
    description?: string
  }
  const shop: LiquidShopData = {
    name: s?.name ?? '',
    email: s?.email ?? '',
    phone: s?.phone ?? '',
    domain: options.host,
    url: options.origin,
    currency: 'INR',
    description: seo.description ?? '',
  }

  const collectionList = (): Promise<LiquidCollectionData[]> =>
    once('collections', async () => {
      const rows = await tx
        .select({
          id: collection.id,
          handle: collection.handle,
          title: collection.title,
          description: collection.description,
          imageUrl: media.url,
          imageAlt: media.alt,
          width: media.width,
          height: media.height,
          count: sql<number>`(select count(*) from ${collectionProduct} cp join ${product} p on p.id = cp.product_id where cp.collection_id = ${collection.id} and p.status = 'active')`,
        })
        .from(collection)
        .leftJoin(media, eq(media.id, collection.imageMediaId))
        .where(eq(collection.status, 'active'))
        .orderBy(asc(collection.title))
      return rows.map((r) => ({
        id: r.id,
        handle: r.handle,
        title: r.title,
        descriptionHtml: toHtml(r.description),
        image: r.imageUrl
          ? { url: r.imageUrl, alt: r.imageAlt ?? r.title, width: r.width, height: r.height }
          : null,
        productsCount: Number(r.count),
      }))
    })

  return {
    shop,
    product: (handle) =>
      once(`p:${handle}`, async () => {
        const [row] = await tx
          .select({ id: product.id })
          .from(product)
          .where(and(eq(product.handle, handle), eq(product.status, 'active')))
        return row ? ((await loadProducts(tx, [row.id]))[0] ?? null) : null
      }),
    collection: async (handle) => {
      if (handle === 'all') {
        const [count] = await tx
          .select({ n: sql<number>`count(*)` })
          .from(product)
          .where(eq(product.status, 'active'))
        return {
          id: 'all',
          handle: 'all',
          title: 'Products',
          descriptionHtml: '',
          image: null,
          productsCount: Number(count?.n ?? 0),
        }
      }
      return (await collectionList()).find((c) => c.handle === handle) ?? null
    },
    collectionProducts: (handle, limit) =>
      once(`cp:${handle}:${limit}`, async () => {
        if (handle === 'all') {
          const rows = await tx
            .select({ id: product.id })
            .from(product)
            .where(eq(product.status, 'active'))
            .orderBy(desc(product.createdAt))
            .limit(limit)
          return loadProducts(
            tx,
            rows.map((r) => r.id),
          )
        }
        const rows = await tx
          .select({ id: product.id })
          .from(collectionProduct)
          .innerJoin(collection, eq(collection.id, collectionProduct.collectionId))
          .innerJoin(product, eq(product.id, collectionProduct.productId))
          .where(and(eq(collection.handle, handle), eq(product.status, 'active')))
          .orderBy(asc(collectionProduct.position))
          .limit(limit)
        return loadProducts(
            tx,
            rows.map((r) => r.id),
          )
      }),
    collections: collectionList,
    menu: (handle) =>
      once(`m:${handle}`, async () => {
        const [row] = await tx.select().from(navigationMenu).where(eq(navigationMenu.handle, handle))
        if (!row) return null
        return { handle: row.handle, title: row.title, links: toLinks(toNavLinks(row.items)) }
      }),
    blog: (handle) =>
      once(`b:${handle}`, async (): Promise<LiquidBlogData | null> => {
        const [b] = await tx.select().from(blog).where(eq(blog.handle, handle))
        if (!b) return null
        const posts = await tx
          .select({
            id: article.id,
            handle: article.handle,
            title: article.title,
            author: article.author,
            excerpt: article.excerpt,
            body: article.body,
            tags: article.tags,
            publishedAt: article.publishedAt,
            imageUrl: media.url,
            imageAlt: article.imageAlt,
          })
          .from(article)
          .leftJoin(media, eq(media.id, article.imageMediaId))
          .where(and(eq(article.blogId, b.id), eq(article.status, 'published')))
          .orderBy(desc(article.publishedAt))
          .limit(50)
        return {
          id: b.id,
          handle: b.handle,
          title: b.title,
          url: `/blogs/${b.handle}`,
          articles: posts.map((a) => ({
            id: a.id,
            handle: a.handle,
            title: a.title,
            url: `/blogs/${b.handle}/${a.handle}`,
            author: a.author,
            excerptHtml: a.excerpt ? `<p>${escapeHtml(a.excerpt)}</p>` : '',
            contentHtml: toHtml(a.body),
            image: a.imageUrl ? { url: a.imageUrl, alt: a.imageAlt ?? a.title } : null,
            tags: a.tags,
            publishedAt: a.publishedAt,
          })),
        }
      }),
    page: (handle) =>
      once(`pg:${handle}`, async () => {
        const [row] = await tx
          .select({ id: page.id, handle: page.handle, title: page.title, body: page.body })
          .from(page)
          .where(and(eq(page.handle, handle), isNotNull(page.publishedAt)))
        return row
          ? { id: row.id, handle: row.handle, title: row.title, contentHtml: toHtml(row.body) }
          : null
      }),
    cart: () => once('cart', () => options.cart?.() ?? Promise.resolve(EMPTY_CART)),
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The variant an imported theme's cart form or script names: our UUID, or the whole
 * number the theme saw (`numeric-id.ts`). Null when it is neither, or matches nothing.
 */
export async function resolveThemeVariantId(tx: StoreTx, raw: string): Promise<string | null> {
  if (UUID.test(raw)) return raw
  const prefix = uuidPrefixOf(raw)
  if (!prefix) return null
  const rows = await tx
    .select({ id: variant.id })
    .from(variant)
    .where(like(sql`${variant.id}::text`, `${prefix}%`))
    .limit(2)
  return rows.length === 1 ? (rows[0]?.id ?? null) : null
}
