import { SHOPIFY_SITEMAPS, type SitemapPart } from '@/data/seo'
import { requestOrigin } from '@/lib/seo'
import { emptySitemapXml, loadStoreIndex, sitemapXml } from '@/lib/seo-files'
import { inStore } from '@/lib/store-context'
import { storefrontLock } from '@/lib/storefront-gate'

type Params = { params: Promise<{ storeId: string; part: string }> }

// Per host and per request: never prerendered at build time.
export const dynamic = 'force-dynamic'

const PARTS = new Set<string>(Object.values(SHOPIFY_SITEMAPS))

/**
 * One part of the sitemap, for Shopify's child sitemaps (`/sitemap_products_1.xml`, rewritten
 * here by the proxy): a store that moved from Shopify keeps answering the URLs Search Console
 * was given, with the same products, collections, pages and posts as `/sitemap.xml`.
 */
export async function GET(_req: Request, { params }: Params) {
  const { storeId, part } = await params
  if (!PARTS.has(part)) return new Response('Not found', { status: 404 })
  const body = !(await storefrontLock(storeId)).search
    ? emptySitemapXml()
    : sitemapXml(
        await requestOrigin(),
        await inStore(storeId, (tx) => loadStoreIndex(tx)),
        part as SitemapPart,
      )
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
