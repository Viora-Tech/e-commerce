import { headers } from 'next/headers'
import { fetchHonoPage } from '@/lib/hono-island/forward'
import { HONO_RENDER } from '@/lib/hono-island/route'
import { forwardToReactPage } from '@/lib/plain-html/forward'
import { withEvlog } from '@/lib/request-log'

/**
 * A product page drawn by the Bun + Hono service (`apps/storefront-hono`, `lib/hono-island`): the
 * proxy rewrites `/products/<handle>` here for a store with `delivery.honoProduct` on while
 * `STOREFRONT_HONO_URL` is set. Anything the service does not answer with a whole page (an error,
 * a timeout, a page it does not draw, a 404) is drawn by the Next page through this same server,
 * as the plain HTML path hands pages back, with the reason in `x-hono-fallback`.
 */
async function answer(req: Request): Promise<Response> {
  const page = await fetchHonoPage(req)
  if (!page.verdict.use) {
    const next = await forwardToReactPage(req)
    next.headers.set('x-hono-fallback', page.verdict.reason)
    return next
  }
  const h = await headers()
  return new Response(req.method === 'HEAD' ? null : page.html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // The shared-cache answer the proxy chose (`lib/edge-cache.ts`), else private.
      'cache-control': h.get('x-edge-cache-control') ?? 'private, no-cache, no-store, max-age=0',
      'x-storefront-render': HONO_RENDER,
    },
  })
}

export const GET = withEvlog(answer)
export const HEAD = withEvlog(answer)
