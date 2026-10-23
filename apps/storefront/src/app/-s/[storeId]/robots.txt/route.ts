import { requestOrigin } from '@/lib/seo'
import { robotsTxt } from '@/lib/seo-files'
import { storefrontLock } from '@/lib/storefront-gate'

type Params = { params: Promise<{ storeId: string }> }

// Per host and per request: never prerendered at build time.
export const dynamic = 'force-dynamic'

/** Per-host robots.txt: the store's own sitemap, private paths out, everything off while locked or
 *  hidden from search, AI crawlers out when the merchant said so. */
export async function GET(_req: Request, { params }: Params) {
  const { storeId } = await params
  const lock = await storefrontLock(storeId)
  return new Response(robotsTxt(await requestOrigin(), lock), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
