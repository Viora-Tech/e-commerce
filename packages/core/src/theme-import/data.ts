/** SOURCE OF TRUTH: the store data an imported theme reads — WHAT: a per-request `LiquidDataSource` over our database (products with variants, options and images; collections and their products; menus; blogs; pages; the shop; extra fields and content entries through `custom-data.ts`), cached within the request / WHY: imported Liquid asks for Shopify objects by handle; this answers from our catalogue under the store's RLS, so the theme shows our live data */
import {
  article,
  blog,
  collection,
  collectionProduct,
  media,
  navigationMenu,
  page,
  product,
  type StoreTx,
  store,
  variant,
} from '@commerce/db'
import { and, asc, desc, eq, isNotNull, like, sql } from 'drizzle-orm'
import { excerptText } from '../blog/text'
import { browseProducts } from '../catalog/browse'
import {
  BROWSE_SORTS,
  parseBrowseFilters,
  parseBrowseSort,
  parsePage,
} from '../catalog/browse-params'
import { keyFromName } from '../metaobjects/validate'
import { toNavLinks } from '../navigation/resolve'
import { publishedPolicyLinks } from '../policies/service'
import { loadMetafields, loadMetaobjects, loadMetaobjectsOfType } from './custom-data'
import type {
  LiquidBlogData,
  LiquidCartData,
  LiquidCollectionData,
  LiquidCustomData,
  LiquidDataSource,
  LiquidLinkData,
  LiquidReviewsSource,
  LiquidShopData,
} from './drops'
import { loadImportedFiles } from './imported-files'
import { uuidPrefixOf } from './numeric-id'
import { collectionsProducts, loadProducts, productsByHandles } from './product-data'
import {
  firstAvailable,
  MAX_RECOMMENDATIONS,
  pickedRecommendationIds,
  relatedProductIds,
} from './related'
import { richTextHtml } from './rich-html'

export type StoreLiquidDataOptions = {
  storeId: string
  /** The host shoppers use (`waimers.in`), for `shop.url`. */
  host: string
  origin: string
  /** The shopper's cart, from the storefront cart cookie; empty in the editor. */
  cart?: (() => Promise<LiquidCartData>) | undefined
  /** The Reviews app's data, when the store installed it (see `withReviewMetafields`). */
  reviews?: LiquidReviewsSource | undefined
}

/**
 * Our ratings as Shopify's standard review metafields (`reviews.rating`, a rating out of 5,
 * and `reviews.rating_count`), which review apps keep on each product and themes read for
 * stars on cards and product pages. A product with our reviews gets ours in place of any
 * copied from Shopify; one without keeps what the importer brought.
 */
export function withReviewMetafields(
  data: LiquidCustomData,
  ratings: Map<string, { rating: number; count: number }>,
): LiquidCustomData {
  const metafields = { ...data.metafields }
  for (const [id, r] of ratings) {
    if (r.count <= 0) continue
    const others = (metafields[id] ?? []).filter((f) => f.namespace !== 'reviews')
    metafields[id] = [
      ...others,
      {
        namespace: 'reviews',
        key: 'rating',
        type: 'rating',
        list: false,
        measure: null,
        value: { value: r.rating, max: 5 },
      },
      {
        namespace: 'reviews',
        key: 'rating_count',
        type: 'number_integer',
        list: false,
        measure: null,
        value: r.count,
      },
    ]
  }
  return { ...data, metafields }
}

const EMPTY_CART: LiquidCartData = { itemCount: 0, totalPrice: 0, items: [] }

const toHtml = richTextHtml

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * `article.excerpt`, which Liquid reads as HTML: the stored excerpt is text (a Shopify import
 * keeps the summary's words), read as plain text first so tags saved in it never show escaped.
 */
function excerptHtml(excerpt: string | null): string {
  const text = excerptText(excerpt)
  return text ? `<p>${escapeHtml(text)}</p>` : ''
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
  // The footer's policy links (`shop.policies`): payment gateways check a store shows them.
  const policyLinks = await publishedPolicyLinks({ tx, storeId: options.storeId })
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
    policies: policyLinks.map((l) => ({ type: l.type, title: l.title, url: l.href })),
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
    products: (handles) => productsByHandles(tx, handles),
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
          // Shopify's `collections.all` reads A to Z by title (an empty cart's "Bestsellers").
          const rows = await tx
            .select({ id: product.id })
            .from(product)
            .where(eq(product.status, 'active'))
            .orderBy(asc(product.title), asc(product.id))
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
    collectionsProducts: (handles, limit) => collectionsProducts(tx, handles, limit),
    collections: collectionList,
    relatedProducts: (productId, limit, intent = 'related') =>
      once(`rel:${productId}:${limit}:${intent}`, async () => {
        const wanted = Math.min(Math.max(1, Math.trunc(limit) || 4), MAX_RECOMMENDATIONS)
        // The merchant's picks first (Search & Discovery); complementary has nothing else.
        const fields = (await loadMetafields(tx, 'product', [productId])).metafields[productId]
        const picked = pickedRecommendationIds(fields ?? [], intent).filter(
          (id) => id !== productId,
        )
        const auto = intent === 'related' ? await relatedProductIds(tx, productId) : []
        const ids = [...new Set([...picked, ...auto])]
        // Sold-out products are dropped after loading (stock lives on the variants), so the
        // ranked list is read in chunks until enough are in stock: the closest matches (same
        // brand and kind) are often all sold out, and one fixed slice of them left the row empty.
        return firstAvailable(ids, wanted, (chunk) => loadProducts(tx, chunk))
      }),
    menu: (handle) =>
      once(`m:${handle}`, async () => {
        const [row] = await tx
          .select()
          .from(navigationMenu)
          .where(eq(navigationMenu.handle, handle))
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
            excerptHtml: excerptHtml(a.excerpt),
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
    metafields: async (ownerType, ownerIds) => {
      const data = await loadMetafields(tx, ownerType, ownerIds)
      if (ownerType !== 'product' || !options.reviews) return data
      return withReviewMetafields(data, await options.reviews.ratings(ownerIds))
    },
    judgeme: () =>
      once('judgeme', async () => (options.reviews ? options.reviews.judgeme() : null)),
    metaobjectsOfType: (type) =>
      once(`mt:${type}`, () => loadMetaobjectsOfType(tx, keyFromName(type))),
    metaobjects: (ids) => loadMetaobjects(tx, ids),
    importedFiles: () => once('imported-files', () => loadImportedFiles(tx)),
    browse: async ({ collectionId, query, perPage }) => {
      const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
      const q = (first(query.q) ?? '').trim().slice(0, 100)
      const filters = parseBrowseFilters(query)
      // Shopify's defaults: a collection's own order, search by relevance.
      const fallback = collectionId ? 'manual' : q ? 'relevance' : 'title-ascending'
      const sort = parseBrowseSort(first(query.sort_by), BROWSE_SORTS, fallback)
      const result = await browseProducts(tx, {
        collectionId: collectionId ?? undefined,
        query: q || undefined,
        // The store's search engine (the Meilisearch app) ranks a search when it has one ready.
        storeId: options.storeId,
        filters,
        sort: sort === 'manual' && !collectionId ? 'title-ascending' : sort,
        page: parsePage(first(query.page)),
        perPage,
      })
      const byHandle = await productsByHandles(tx, result.handles)
      return {
        products: result.handles.flatMap((h) => byHandle.get(h) ?? []),
        total: result.total,
        facets: result.facets,
        filters,
        sort,
        q,
      }
    },
  }
}

/** The product an imported theme's script names: our UUID or the whole number it was shown. Null when neither matches. */
export async function resolveThemeProductId(tx: StoreTx, raw: string): Promise<string | null> {
  if (UUID.test(raw)) return raw
  const prefix = uuidPrefixOf(raw)
  if (!prefix) return null
  const rows = await tx
    .select({ id: product.id })
    .from(product)
    .where(like(sql`${product.id}::text`, `${prefix}%`))
    .limit(2)
  return rows.length === 1 ? (rows[0]?.id ?? null) : null
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
