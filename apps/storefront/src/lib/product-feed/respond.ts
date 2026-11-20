import 'server-only'
import { type StoreTx, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { PRODUCT_FEED } from '@/data/product-feed'
import { clientIp, rateLimited, retryAfterSeconds } from '../rate-limit'
import { requestOrigin } from '../seo'
import { feedProducts } from '../shopify-json/load'
import type { FeedProduct } from '../shopify-json/shape'
import { storeRead } from '../store-cache'
import { storefrontLock } from '../storefront-gate'
import { feedCsv, feedRows, feedXml } from './shape'

export type FeedFormat = 'xml' | 'csv'

const CONTENT_TYPE: Record<FeedFormat, string> = {
  xml: 'application/xml; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
}

/** Every published product, newest first, up to the feed's cap (the Shopify JSON's own reader). */
async function allProducts(tx: StoreTx): Promise<FeedProduct[]> {
  const out: FeedProduct[] = []
  const pages = Math.ceil(PRODUCT_FEED.maxProducts / PRODUCT_FEED.pageSize)
  for (let page = 1; page <= pages; page++) {
    const batch = await feedProducts(tx, { limit: PRODUCT_FEED.pageSize, page })
    out.push(...batch)
    if (batch.length < PRODUCT_FEED.pageSize) break
  }
  return out
}

async function build(tx: StoreTx, storeId: string, origin: string, format: FeedFormat) {
  const [s] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
  const storeName = s?.name ?? ''
  const rows = feedRows(await allProducts(tx), { origin, storeName })
  if (format === 'csv') return feedCsv(rows)
  return feedXml(rows, {
    title: storeName,
    link: origin,
    description: `${PRODUCT_FEED.description} ${storeName}`.trim(),
  })
}

/**
 * The public product feed: 404 unless the store switched it on (Preferences › Product feeds),
 * rate limited per IP, built once per store version and host (`storeRead`, so an edit shows on
 * the next read), public and cacheable. The password page keeps it closed like every page.
 */
export async function productFeedResponse(
  request: Request,
  storeId: string,
  format: FeedFormat,
): Promise<Response> {
  const lock = await storefrontLock(storeId)
  if (!lock.productFeed || lock.enabled) {
    return new Response(PRODUCT_FEED.notFound, {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
  const limit = await rateLimited('product-feed:ip', clientIp(request.headers), PRODUCT_FEED.ipRule)
  if (!limit.ok) {
    return new Response(PRODUCT_FEED.tooMany, {
      status: 429,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'retry-after': String(retryAfterSeconds(limit)),
      },
    })
  }
  const origin = await requestOrigin()
  const body = await storeRead(storeId, `product-feed|${format}|${origin}`, (tx) =>
    build(tx, storeId, origin, format),
  )
  return new Response(request.method === 'HEAD' ? null : body, {
    headers: {
      'content-type': CONTENT_TYPE[format],
      'cache-control': PRODUCT_FEED.cacheControl,
      'x-robots-tag': 'noindex',
      ...(format === 'csv' ? { 'content-disposition': 'inline; filename="products.csv"' } : {}),
    },
  })
}
