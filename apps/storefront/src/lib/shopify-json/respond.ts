import 'server-only'
import type { StoreTx } from '@commerce/db'
import { SHOPIFY_JSON } from '@/data/shopify-json'
import { clientIp, rateLimited, retryAfterSeconds } from '../rate-limit'
import { storeRead } from '../store-cache'

/**
 * The answer of every Shopify-compatible JSON endpoint: rate limited per IP, built once per
 * store version (`storeRead`, kept as the finished body so a 250-product page is not
 * re-serialised per request), public and cacheable. `build` returns null for a 404.
 */
export async function shopifyJsonResponse(
  request: Request,
  storeId: string,
  key: string,
  build: (tx: StoreTx) => Promise<unknown | null>,
  contentType = 'application/json; charset=utf-8',
): Promise<Response> {
  const limit = await rateLimited('shopify-json:ip', clientIp(request.headers), SHOPIFY_JSON.ipRule)
  if (!limit.ok) {
    return Response.json(
      { errors: SHOPIFY_JSON.tooMany },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds(limit)) } },
    )
  }
  const body = await storeRead(storeId, `shopify-json|${key}`, async (tx) => {
    const value = await build(tx)
    return value === null ? null : JSON.stringify(value)
  })
  if (body === null) {
    return Response.json(
      { errors: SHOPIFY_JSON.notFound },
      { status: 404, headers: { 'cache-control': SHOPIFY_JSON.cacheControl } },
    )
  }
  return new Response(request.method === 'HEAD' ? null : body, {
    headers: {
      'content-type': contentType,
      'cache-control': SHOPIFY_JSON.cacheControl,
      'x-robots-tag': 'noindex',
    },
  })
}
