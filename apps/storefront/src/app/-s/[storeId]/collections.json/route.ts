import { withEvlog } from '@/lib/request-log'
import { feedCollections } from '@/lib/shopify-json/load'
import { shopifyJsonResponse } from '@/lib/shopify-json/respond'
import { collectionJson } from '@/lib/shopify-json/shape'

type Params = { params: Promise<{ storeId: string }> }

// Per host: never prerendered at build time.
export const dynamic = 'force-dynamic'

/** Shopify's public `/collections.json`: every active collection with its product count. */
async function answer(request: Request, { params }: Params) {
  const { storeId } = await params
  return shopifyJsonResponse(request, storeId, 'collections', async (tx) => ({
    collections: (await feedCollections(tx)).map(collectionJson),
  }))
}

export const GET = withEvlog(answer)
export const HEAD = withEvlog(answer)
