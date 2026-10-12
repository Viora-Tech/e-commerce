/** SOURCE OF TRUTH: loading the SEO report — WHAT: reads every live product (with its photo and barcode counts), active collection and published page of the store and runs the checks in `checks.ts` over them / WHY: the report page and "Fix with AI" read one result, inside RLS */
import { collection, media, page, product, productMedia, type StoreTx, variant } from '@commerce/db'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { notSystemTest } from '../catalog/system-test'
import { type SeoItem, type SeoReport, seoBodyText, seoReport } from './checks'

/** More than this many items and the report checks the first ones (by title) only. */
export const SEO_REPORT_MAX_ITEMS = 5_000

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
  }))
}

async function collectionItems(tx: StoreTx): Promise<SeoItem[]> {
  const rows = await tx
    .select({
      id: collection.id,
      title: collection.title,
      handle: collection.handle,
      seoTitle: collection.seoTitle,
      seoDescription: collection.seoDescription,
      description: collection.description,
    })
    .from(collection)
    .where(eq(collection.status, 'active'))
    .orderBy(collection.title)
    .limit(SEO_REPORT_MAX_ITEMS)
  return rows.map((r) => ({ resource: 'collection', ...r, bodyText: seoBodyText(r.description) }))
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
  return rows.map((r) => ({ resource: 'page', ...r, bodyText: seoBodyText(r.body) }))
}

/** The store's SEO report over everything shoppers (and search engines) can see. */
export async function loadSeoReport(tx: StoreTx): Promise<SeoReport> {
  const items = [
    ...(await productItems(tx)),
    ...(await collectionItems(tx)),
    ...(await pageItems(tx)),
  ]
  return seoReport(items)
}
