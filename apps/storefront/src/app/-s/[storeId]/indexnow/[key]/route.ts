import { indexNowKeyFor } from '@commerce/core'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string; key: string }> }

// Per host and per request: never prerendered at build time.
export const dynamic = 'force-dynamic'

/**
 * IndexNow's key file at `/<key>.txt` (the proxy routes it here, `lib/routing.ts`): the key
 * itself, as plain text, when it is this store's; Bing and Yandex read it to trust the store's
 * pings (`apps/worker/src/indexnow.ts`). Any other key is a 404.
 */
export async function GET(_req: Request, { params }: Params) {
  const { storeId, key } = await params
  const own = await inStore(storeId, (tx) => indexNowKeyFor(tx, storeId))
  if (!own || own !== key) return new Response('Not found', { status: 404 })
  return new Response(own, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=86400',
    },
  })
}
