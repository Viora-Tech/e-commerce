import { predictiveResponse } from '@/lib/predictive-route'
import { withEvlog } from '@/lib/request-log'

type Params = { params: Promise<{ storeId: string }> }

// Per host and per query: never prerendered at build time.
export const dynamic = 'force-dynamic'

/**
 * Shopify's `/search/suggest`: with `section_id`, the theme's predictive search section
 * rendered with the results; without, the same JSON as `/search/suggest.json`.
 */
export const GET = withEvlog(async (request: Request, { params }: Params) => {
  const { storeId } = await params
  return predictiveResponse(request, storeId, false)
})
