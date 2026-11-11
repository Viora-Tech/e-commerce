import { Hono } from 'hono'
import { renderProductPage } from './product-page'
import { requestContext } from './request-context'
import { routeRequest } from './routing'

/**
 * Pilot storefront server (roadmap, speed track step 6, option B): Bun + Hono answering one page
 * type, `/products/:handle` of an imported Shopify theme, with the Next storefront's own loaders,
 * Liquid engine and render cache. Plain HTML out; no Next, no RSC payload, no client runtime.
 *
 * `PORT` (default 3200), `STORE_ID` (pins a store when the Host header does not resolve one),
 * `STOREFRONT_CACHE_MB` (0 turns the render cache off, as on the Next storefront).
 */

const app = new Hono()

app.get('/healthz', (c) => c.text('ok'))

app.get('/products/:handle', async (c) => {
  const handle = c.req.param('handle')
  const pathname = new URL(c.req.url).pathname
  const routed = await routeRequest(c.req.raw, pathname)
  if (!routed) return c.text('No store is configured for this host.', 404)
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
    [routed.csp.name]: routed.csp.value,
  })
})

const port = Number(process.env.PORT ?? 3200)

// Bun closes a connection idle for 10 s by default, which cuts off a slow uncached page under
// load; Next keeps waiting, so this server does too (255 s is Bun's maximum).
export default { port, fetch: app.fetch, idleTimeout: 255 }

console.log(`storefront-hono listening on http://localhost:${port}`)
