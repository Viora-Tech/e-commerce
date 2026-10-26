import { predictiveResponse } from '@/lib/predictive-route'
import { withEvlog } from '@/lib/request-log'

type Params = { params: Promise<{ storeId: string }> }

// Per host and per query: never prerendered at build time.
export const dynamic = 'force-dynamic'

/** Shopify's `/search/suggest.json` for an imported theme's header search (see `predictive-route.ts`). */
export const GET = withEvlog(async (request: Request, { params }: Params) => {
  const { storeId } = await params
  return predictiveResponse(request, storeId, true)
})
