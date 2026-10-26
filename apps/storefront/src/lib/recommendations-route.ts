import 'server-only'
import { renderRecommendations } from './liquid-theme'
import { clientIp, rateLimited, retryAfterSeconds } from './rate-limit'
import { recommendationsJson, recommendationsParams, validSectionId } from './recommendations-json'
import { recommendedProducts } from './recommended-products'
import { inStore } from './store-context'

/** As predictive search: a product page asks once or twice per view (related, complementary). */
const RECOMMENDATIONS_IP_RULE = { limit: 60, windowMs: 60_000 }

const CACHE = 'public, max-age=60, stale-while-revalidate=300'

/**
 * Shopify's Product Recommendations endpoints on a store's own domain, for an imported
 * theme's "You may also like" / "Pairs well with" rows:
 * `/recommendations/products.json?product_id=&limit=&intent=` answers JSON in Shopify's
 * shape; `/recommendations/products?section_id=<id>&product_id=…` answers that theme section
 * rendered with `recommendations` filled, and JSON without a section. The ranking is core's
 * related products (theme-import `related.ts`). A locked store never gets here: the proxy
 * serves the password page instead.
 */
export async function recommendationsResponse(
  request: Request,
  storeId: string,
  json: boolean,
): Promise<Response> {
  const ip = clientIp(request.headers)
  const limit = await rateLimited('recommendations:ip', ip, RECOMMENDATIONS_IP_RULE)
  if (!limit.ok) {
    return Response.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds(limit)) } },
    )
  }
  const p = recommendationsParams(new URL(request.url).searchParams)
  const sectionId = json ? '' : p.sectionId
  if (!p.productId) {
    return Response.json(
      { status: 422, message: 'Invalid parameter error', description: 'product_id is required' },
      { status: 422 },
    )
  }
  if (sectionId) {
    if (!validSectionId(sectionId)) return new Response('Not found', { status: 404 })
    const html = await inStore(storeId, (tx) =>
      renderRecommendations(tx, storeId, { ...p, sectionId }),
    )
    if (html === null) return new Response('Not found', { status: 404 })
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': CACHE },
    })
  }
  const products = await inStore(storeId, (tx) => recommendedProducts(tx, storeId, p))
  if (products === null) {
    return Response.json(
      { status: 404, message: 'Product not found', description: 'No product with that id' },
      { status: 404 },
    )
  }
  return Response.json(recommendationsJson(products, p.intent), {
    headers: { 'cache-control': CACHE },
  })
}
