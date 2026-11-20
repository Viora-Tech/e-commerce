import { withEvlog } from '@/lib/request-log'
import { feedProducts } from '@/lib/shopify-json/load'
import { shopifyJsonResponse } from '@/lib/shopify-json/respond'
import { feedPaging, listProduct } from '@/lib/shopify-json/shape'

type Params = { params: Promise<{ storeId: string }> }

// Per host and per page: never prerendered at build time.
export const dynamic = 'force-dynamic'

/** Shopify's public `/products.json?limit=&page=`: published products for feeds and price sites. */
async function answer(request: Request, { params }: Params) {
  const { storeId } = await params
  const paging = feedPaging(new URL(request.url).searchParams)
  return shopifyJsonResponse(
    request,
    storeId,
    `products|${paging.limit}|${paging.page}`,
    async (tx) => ({
      products: (await feedProducts(tx, paging)).map(listProduct),
    }),
  )
}

export const GET = withEvlog(answer)
export const HEAD = withEvlog(answer)
