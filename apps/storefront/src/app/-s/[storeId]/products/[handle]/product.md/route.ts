import { withEvlog } from '@/lib/request-log'
import { requestOrigin } from '@/lib/seo'
import { feedProduct } from '@/lib/shopify-json/load'
import { productMarkdown } from '@/lib/shopify-json/markdown'
import { decodedHandle } from '@/lib/shopify-json/paths'
import { shopifyJsonResponse } from '@/lib/shopify-json/respond'

type Params = { params: Promise<{ storeId: string; handle: string }> }

// Per host and per product: never prerendered at build time.
export const dynamic = 'force-dynamic'

/**
 * `/products/<handle>.md` (the proxy rewrites it here, `lib/shopify-json/paths.ts`): the product
 * as Markdown for AI agents, linked from the product page's `rel="alternate"` Markdown link.
 */
async function answer(request: Request, { params }: Params) {
  const { storeId, handle: raw } = await params
  const handle = decodedHandle(raw)
  const origin = await requestOrigin()
  return shopifyJsonResponse(
    request,
    storeId,
    `product-md|${origin}|${handle}`,
    async (tx) => {
      const found = handle ? await feedProduct(tx, handle) : null
      return found ? productMarkdown(found, origin) : null
    },
    'text/markdown; charset=utf-8',
  )
}

export const GET = withEvlog(answer)
export const HEAD = withEvlog(answer)
