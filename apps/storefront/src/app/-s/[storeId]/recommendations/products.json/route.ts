import { recommendationsResponse } from '@/lib/recommendations-route'
import { withEvlog } from '@/lib/request-log'

type Params = { params: Promise<{ storeId: string }> }

// Per host and per product: never prerendered at build time.
export const dynamic = 'force-dynamic'

/** Shopify's `/recommendations/products.json` for an imported theme (see `recommendations-route.ts`). */
export const GET = withEvlog(async (request: Request, { params }: Params) => {
  const { storeId } = await params
  return recommendationsResponse(request, storeId, true)
})
