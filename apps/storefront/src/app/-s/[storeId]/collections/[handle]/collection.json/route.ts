import { withEvlog } from '@/lib/request-log'
import { feedCollections } from '@/lib/shopify-json/load'
import { decodedHandle } from '@/lib/shopify-json/paths'
import { shopifyJsonResponse } from '@/lib/shopify-json/respond'
import { collectionJson } from '@/lib/shopify-json/shape'

type Params = { params: Promise<{ storeId: string; handle: string }> }

// Per host and per collection: never prerendered at build time.
export const dynamic = 'force-dynamic'

/** Shopify's public `/collections/<handle>.json` (the proxy rewrites it here, `lib/shopify-json/paths.ts`). */
async function answer(request: Request, { params }: Params) {
  const { storeId, handle: raw } = await params
  const handle = decodedHandle(raw)
  return shopifyJsonResponse(request, storeId, `collection|${handle}`, async (tx) => {
    const found = handle ? (await feedCollections(tx)).find((c) => c.handle === handle) : null
    return found ? { collection: collectionJson(found) } : null
  })
}

export const GET = withEvlog(answer)
export const HEAD = withEvlog(answer)
