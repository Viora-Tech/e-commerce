import { withEvlog } from '@/lib/request-log'
import { feedCollectionProducts } from '@/lib/shopify-json/load'
import { decodedHandle } from '@/lib/shopify-json/paths'
import { shopifyJsonResponse } from '@/lib/shopify-json/respond'
import { feedPaging, listProduct } from '@/lib/shopify-json/shape'

type Params = { params: Promise<{ storeId: string; handle: string }> }

// Per host and per collection: never prerendered at build time.
export const dynamic = 'force-dynamic'

/** Shopify's public `/collections/<handle>/products.json`: the collection's published products. */
async function answer(request: Request, { params }: Params) {
  const { storeId, handle: raw } = await params
  const handle = decodedHandle(raw)
  const paging = feedPaging(new URL(request.url).searchParams)
  return shopifyJsonResponse(
    request,
    storeId,
    `collection-products|${handle}|${paging.limit}|${paging.page}`,
    async (tx) => {
      const products = handle ? await feedCollectionProducts(tx, handle, paging) : null
      return products ? { products: products.map(listProduct) } : null
    },
  )
}

export const GET = withEvlog(answer)
export const HEAD = withEvlog(answer)
