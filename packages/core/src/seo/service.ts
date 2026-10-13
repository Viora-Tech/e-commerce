/** SOURCE OF TRUTH: loading the SEO report — WHAT: reads every live product (with its photo and barcode counts), active collection (with its product count), published page and menu of the store, plus the paths that exist or redirect and the store's domains, and runs the checks in `checks.ts` over them / WHY: the report page and "Fix with AI" read one result, inside RLS */
import {
  collection,
  collectionProduct,
  media,
  type NavigationItem,
  navigationMenu,
  page,
  product,
  productMedia,
  type StoreTx,
  storeDomain,
  urlRedirect,
  variant,
} from '@commerce/db'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { notSystemTest } from '../catalog/system-test'
import {
  type SeoItem,
  type SeoLinkContext,
  type SeoMenuLink,
  type SeoReport,
  seoBodyText,
  seoReport,
} from './checks'
import { normalizeStorePath, seoBodyLinks } from './links'

/** More than this many items and the report checks the first ones (by title) only. */
const SEO_REPORT_MAX_ITEMS = 5_000

const blank = (column: typeof media.alt | typeof variant.barcode) =>
  sql`coalesce(trim(${column}), '') = ''`

async function productItems(tx: StoreTx): Promise<SeoItem[]> {
  const photos = tx
    .select({
      productId: productMedia.productId,
      total: sql<number>`count(*)::int`.as('total'),
      noAlt: sql<number>`count(*) filter (where ${blank(media.alt)})::int`.as('no_alt'),
    })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .groupBy(productMedia.productId)
    .as('photos')
  const barcodes = tx
    .select({
      productId: variant.productId,
      withBarcode: sql<number>`count(*) filter (where not ${blank(variant.barcode)})::int`.as(
        'with_barcode',
      ),
    })
    .from(variant)
    .groupBy(variant.productId)
    .as('barcodes')
  const rows = await tx
    .select({
      id: product.id,
      title: product.title,
      handle: product.handle,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      description: product.description,
      vendor: product.vendor,
      categoryId: product.categoryId,
      keywordCount: sql<number>`cardinality(${product.seoKeywords})`,
      photos: photos.total,
      noAlt: photos.noAlt,
      withBarcode: barcodes.withBarcode,
    })
    .from(product)
    .leftJoin(photos, eq(photos.productId, product.id))
    .leftJoin(barcodes, eq(barcodes.productId, product.id))
    .where(and(eq(product.status, 'active'), notSystemTest))
    .orderBy(product.title)
    .limit(SEO_REPORT_MAX_ITEMS)
  return rows.map((r) => ({
    resource: 'product',
    id: r.id,
    title: r.title,
    handle: r.handle,
    seoTitle: r.seoTitle,
    seoDescription: r.seoDescription,
    bodyText: seoBodyText(r.description),
    imageCount: r.photos ?? 0,
    imagesWithoutAlt: r.noAlt ?? 0,
    vendor: r.vendor,
    hasBarcode: (r.withBarcode ?? 0) > 0,
    hasCategory: Boolean(r.categoryId),
    keywordCount: r.keywordCount,
    links: seoBodyLinks(r.description),
  }))
}

async function collectionItems(tx: StoreTx): Promise<SeoItem[]> {
  const members = tx
    .select({
      collectionId: collectionProduct.collectionId,
      live: sql<number>`count(*)::int`.as('live'),
    })
    .from(collectionProduct)
    .innerJoin(product, eq(product.id, collectionProduct.productId))
    .where(and(eq(product.status, 'active'), notSystemTest))
    .groupBy(collectionProduct.collectionId)
    .as('members')
  const rows = await tx
    .select({
      id: collection.id,
      title: collection.title,
      handle: collection.handle,
      seoTitle: collection.seoTitle,
      seoDescription: collection.seoDescription,
      description: collection.description,
      imageMediaId: collection.imageMediaId,
      live: members.live,
    })
    .from(collection)
    .leftJoin(members, eq(members.collectionId, collection.id))
    .where(eq(collection.status, 'active'))
    .orderBy(collection.title)
    .limit(SEO_REPORT_MAX_ITEMS)
  return rows.map((r) => ({
    resource: 'collection',
    id: r.id,
    title: r.title,
    handle: r.handle,
    seoTitle: r.seoTitle,
    seoDescription: r.seoDescription,
    bodyText: seoBodyText(r.description),
    productCount: r.live ?? 0,
    hasImage: Boolean(r.imageMediaId),
    links: seoBodyLinks(r.description),
  }))
}

async function pageItems(tx: StoreTx): Promise<SeoItem[]> {
  const rows = await tx
    .select({
      id: page.id,
      title: page.title,
      handle: page.handle,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      body: page.body,
    })
    .from(page)
    .where(isNotNull(page.publishedAt))
    .orderBy(page.title)
    .limit(SEO_REPORT_MAX_ITEMS)
  return rows.map((r) => ({
    resource: 'page',
    id: r.id,
    title: r.title,
    handle: r.handle,
    seoTitle: r.seoTitle,
    seoDescription: r.seoDescription,
    bodyText: seoBodyText(r.body),
    links: seoBodyLinks(r.body),
  }))
}

/** A menu entry's destination as a store path or URL; null for entries that cannot break. */
function menuItemUrl(item: NavigationItem): string | null {
  if (!item.value) return null
  if (item.type === 'product') return `/products/${item.value}`
  if (item.type === 'collection') return `/collections/${item.value}`
  if (item.type === 'page') return `/pages/${item.value}`
  if (item.type === 'url') return item.value
  return null
}

async function menuLinks(tx: StoreTx): Promise<SeoMenuLink[]> {
  const menus = await tx
    .select({ id: navigationMenu.id, title: navigationMenu.title, items: navigationMenu.items })
    .from(navigationMenu)
  const out: SeoMenuLink[] = []
  const walk = (menu: { id: string; title: string }, items: readonly NavigationItem[]) => {
    for (const item of items) {
      const url = menuItemUrl(item)
      if (url) out.push({ menuId: menu.id, menuTitle: menu.title, itemTitle: item.title, url })
      walk(menu, item.children ?? [])
    }
  }
  for (const m of menus) walk(m, Array.isArray(m.items) ? m.items : [])
  return out
}

/** Paths shoppers can open: live products, active collections, published pages, and redirects. */
async function linkContext(tx: StoreTx): Promise<SeoLinkContext> {
  const [products, collections, pages, redirects, domains, menus] = [
    await tx
      .select({ handle: product.handle })
      .from(product)
      .where(and(eq(product.status, 'active'), notSystemTest)),
    await tx
      .select({ handle: collection.handle })
      .from(collection)
      .where(eq(collection.status, 'active')),
    await tx.select({ handle: page.handle }).from(page).where(isNotNull(page.publishedAt)),
    await tx.select({ path: urlRedirect.path }).from(urlRedirect),
    await tx.select({ hostname: storeDomain.hostname }).from(storeDomain),
    await menuLinks(tx),
  ]
  const knownPaths = new Set([
    ...products.map((r) => `/products/${r.handle.toLowerCase()}`),
    ...collections.map((r) => `/collections/${r.handle.toLowerCase()}`),
    ...pages.map((r) => `/pages/${r.handle.toLowerCase()}`),
    ...redirects.map((r) => normalizeStorePath(r.path)),
  ])
  const storeHosts = new Set(domains.map((d) => d.hostname.toLowerCase().replace(/^www\./, '')))
  return { knownPaths, storeHosts, menus }
}

/** The store's SEO report over everything shoppers (and search engines) can see. */
export async function loadSeoReport(tx: StoreTx): Promise<SeoReport> {
  const items = [
    ...(await productItems(tx)),
    ...(await collectionItems(tx)),
    ...(await pageItems(tx)),
  ]
  return seoReport(items, await linkContext(tx))
}
