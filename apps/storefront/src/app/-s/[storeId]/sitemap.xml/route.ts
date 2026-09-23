import { requestOrigin } from '@/lib/seo'
import { emptySitemapXml, loadStoreIndex, sitemapXml } from '@/lib/seo-files'
import { inStore } from '@/lib/store-context'
import { storefrontLock } from '@/lib/storefront-gate'

type Params = { params: Promise<{ storeId: string }> }

// Per host and per request: never prerendered at build time.
export const dynamic = 'force-dynamic'

/** Per-host sitemap from the database: active products and collections, published pages and posts. */
export async function GET(_req: Request, { params }: Params) {
  const { storeId } = await params
  const body = (await storefrontLock(storeId)).enabled
    ? emptySitemapXml()
    : sitemapXml(await requestOrigin(), await inStore(storeId, (tx) => loadStoreIndex(tx)))
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
