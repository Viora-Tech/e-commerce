import { shopifyProductJson } from '@/lib/recommendations-json'
import { withEvlog } from '@/lib/request-log'
import { feedProduct } from '@/lib/shopify-json/load'
import { decodedHandle } from '@/lib/shopify-json/paths'
import { shopifyJsonResponse } from '@/lib/shopify-json/respond'

type Params = { params: Promise<{ storeId: string; handle: string }> }

// Per host and per product: never prerendered at build time.
export const dynamic = 'force-dynamic'

/**
 * Shopify's public `/products/<handle>.js` (the proxy rewrites it here, `lib/shopify-json/paths.ts`):
 * the AJAX product, prices in paise as Shopify's subunit, as themes and widgets read it.
 */
async function answer(request: Request, { params }: Params) {
  const { storeId, handle: raw } = await params
  const handle = decodedHandle(raw)
  return shopifyJsonResponse(request, storeId, `product-js|${handle}`, async (tx) => {
    const found = handle ? await feedProduct(tx, handle) : null
    return found ? shopifyProductJson(found) : null
  })
}

export const GET = withEvlog(answer)
export const HEAD = withEvlog(answer)
