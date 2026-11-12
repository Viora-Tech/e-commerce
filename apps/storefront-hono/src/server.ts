import { Hono } from 'hono'
import { HONO_FORWARD_HEADER } from '@/lib/hono-island/route'
import { islandFile } from './island/assets'
import { renderProductPage } from './product-page'
import { requestContext } from './request-context'
import { routeRequest } from './routing'

/**
 * Storefront product page server (roadmap, speed track step 6, option B): Bun + Hono answering one
 * page type, `/products/:handle` of an imported Shopify theme, with the Next storefront's own
 * loaders, Liquid engine and render cache. Plain HTML out, with the buy box as the one React
 * island (`src/island`); no Next, no RSC payload.
 *
 * In production it sits behind the Next storefront, which forwards product pages of the stores
 * switched on (`delivery.honoProduct`) and draws the page itself whenever this server does not
 * answer 200 (`apps/storefront/src/lib/hono-island`). So anything unexpected here answers an
 * error status, never a half page.
 *
 * `PORT` (default 3200), `STORE_ID` (pins a store when the Host header does not resolve one, direct
 * requests only), `STOREFRONT_CACHE_MB` (0 turns the render cache off, as on the Next storefront),
 * `STOREFRONT_HONO_DIRECT=1` (answer requests that did not come through Next in production).
 */

const app = new Hono()

app.get('/healthz', (c) => c.text('ok'))

// The island's script and chunks: `/hono-island/<file>` behind Next (its `/api/hono-island/<file>`
// passes them on), and the same path Next uses when this server is opened directly.
const asset = (name: string) => {
  const found = islandFile(name)
  if (!found) return new Response('Not found', { status: 404 })
  return new Response(found.file, {
    headers: {
      'content-type': found.type,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}
app.get('/hono-island/:file', (c) => asset(c.req.param('file')))
app.get('/api/hono-island/:file', (c) => asset(c.req.param('file')))

app.get('/products/:handle', async (c) => {
  const handle = c.req.param('handle')
  const pathname = new URL(c.req.url).pathname
  const routed = await routeRequest(c.req.raw, pathname)
  if (!routed) {
    // A forward that does not verify (another SETTINGS_SECRET?) is a failure Next counts.
    const forged = c.req.raw.headers.has(HONO_FORWARD_HEADER)
    return c.text(
      forged ? 'Forward not verified.' : 'No store is configured for this host.',
      forged ? 403 : 404,
    )
  }
  const result = await requestContext.run({ headers: routed.headers, memo: new Map() }, () =>
    renderProductPage(routed.storeId, handle),
  )
  if ('notFound' in result) return c.text('Not found', 404)
  if ('skip' in result) {
    return c.text(`This product page cannot be drawn by the pilot: ${result.skip}`, 501, {
      'x-plain-skip-reason': result.skip,
    })
  }
  return c.body(result.html, 200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'private, no-cache, no-store, max-age=0',
    'x-storefront-render': 'hono',
    ...(routed.csp ? { [routed.csp.name]: routed.csp.value } : {}),
  })
})

// Any throw is a 500, which the Next storefront answers by drawing the page itself.
app.onError((err, c) => {
  console.error('[storefront-hono]', c.req.path, err)
  return c.text('Internal error', 500)
})

const port = Number(process.env.PORT ?? 3200)

// Bun closes a connection idle for 10 s by default, which cuts off a slow uncached page under
// load; Next keeps waiting, so this server does too (255 s is Bun's maximum).
export default { port, fetch: app.fetch, idleTimeout: 255 }

console.log(`storefront-hono listening on http://localhost:${port}`)
