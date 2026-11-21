import { productFeedResponse } from '@/lib/product-feed/respond'
import { withEvlog } from '@/lib/request-log'

type Params = { params: Promise<{ storeId: string }> }

// Per host and per store version: never prerendered at build time.
export const dynamic = 'force-dynamic'

/** `/feeds/products.csv`: every published variant for feed tools, when the store switched it on. */
async function answer(request: Request, { params }: Params) {
  const { storeId } = await params
  return productFeedResponse(request, storeId, 'csv')
}

export const GET = withEvlog(answer)
export const HEAD = withEvlog(answer)
