import { headers } from 'next/headers'
import { forwardToReactPage } from '@/lib/plain-html/forward'
import { renderPlainPage } from '@/lib/plain-html/render'
import { withEvlog } from '@/lib/request-log'

type Params = { params: Promise<{ storeId: string; path?: string[] }> }

/**
 * A storefront page sent as plain HTML (Preferences › Storefront speed, `lib/plain-html`): the
 * proxy rewrites `/` and `/pages/<handle>` here for a store with the switch on. A page that
 * cannot go out plain yet is handed back to the React page through this same server.
 */
async function answer(req: Request, { params }: Params): Promise<Response> {
  const { storeId } = await params
  const result = await renderPlainPage(storeId)
  if ('skip' in result) {
    const page = await forwardToReactPage(req)
    // Why this page is not plain yet, for whoever is checking the switch (`curl -I`).
    page.headers.set('x-plain-skip-reason', result.skip)
    return page
  }
  const h = await headers()
  return new Response(req.method === 'HEAD' ? null : result.html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // The shared-cache answer the proxy chose (`lib/edge-cache.ts`), else private.
      'cache-control': h.get('x-edge-cache-control') ?? 'private, no-cache, no-store, max-age=0',
      'x-storefront-render': 'plain',
    },
  })
}

export const GET = withEvlog(answer)
export const HEAD = withEvlog(answer)
