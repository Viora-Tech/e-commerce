import { recommendationsResponse } from '@/lib/recommendations-route'
import { withEvlog } from '@/lib/request-log'

type Params = { params: Promise<{ storeId: string }> }

// Per host and per product: never prerendered at build time.
export const dynamic = 'force-dynamic'

/**
 * Shopify's `/recommendations/products`: with `section_id`, the theme's recommendations
 * section rendered with our related products; without, the same JSON as `.json`.
 */
export const GET = withEvlog(async (request: Request, { params }: Params) => {
  const { storeId } = await params
  return recommendationsResponse(request, storeId, false)
})
