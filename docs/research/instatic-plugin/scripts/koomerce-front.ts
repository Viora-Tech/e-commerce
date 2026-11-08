/**
 * Stand-in for the Koomerce storefront edge in front of Instatic (eval only).
 *
 * - `/cart/add.js` (POST, Shopify body `{items:[{id,quantity}]}` or `{id,quantity}`) and
 *   `/cart.js` answer like our storefront shim does for imported themes; the cart is
 *   kept in memory per `wc_cart` cookie.
 * - Everything else is proxied to the Instatic server, which serves the baked page,
 *   CSS bundles, module JS and `/_instatic/hole/*` fragments.
 *
 * Usage: bun koomerce-front.ts   (listens on http://localhost:4100)
 */
const ORIGIN = 'http://localhost:3001'
const carts = new Map<string, Map<string, number>>()

function cartId(req: Request): { id: string; fresh: boolean } {
  const m = /(?:^|;\s*)wc_cart=([\w-]+)/.exec(req.headers.get('cookie') ?? '')
  return m ? { id: m[1], fresh: false } : { id: crypto.randomUUID(), fresh: true }
}

function cartJson(id: string) {
  const c = carts.get(id) ?? new Map()
  const items = [...c].map(([variant_id, quantity]) => ({ variant_id, quantity }))
  return { token: id, item_count: items.reduce((n, i) => n + i.quantity, 0), items }
}

Bun.serve({
  port: 4100,
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/cart/add.js' && req.method === 'POST') {
      const { id, fresh } = cartId(req)
      const body = (await req.json().catch(() => null)) as {
        items?: Array<{ id: string; quantity?: number }>
        id?: string
        quantity?: number
      } | null
      const lines = body?.items ?? (body?.id ? [{ id: body.id, quantity: body.quantity }] : [])
      if (!lines.length)
        return Response.json({ status: 422, description: 'No items' }, { status: 422 })
      const c = carts.get(id) ?? new Map<string, number>()
      for (const l of lines)
        c.set(String(l.id), (c.get(String(l.id)) ?? 0) + (Number(l.quantity) || 1))
      carts.set(id, c)
      const headers = new Headers({ 'cache-control': 'no-store' })
      if (fresh) headers.set('set-cookie', `wc_cart=${id}; Path=/; HttpOnly; SameSite=Lax`)
      return Response.json({ items: lines }, { headers })
    }
    if (url.pathname === '/cart.js') {
      return Response.json(cartJson(cartId(req).id), { headers: { 'cache-control': 'no-store' } })
    }
    const upstream = await fetch(ORIGIN + url.pathname + url.search, {
      method: req.method,
      headers: req.headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
      redirect: 'manual',
    })
    const headers = new Headers(upstream.headers)
    headers.delete('content-encoding')
    headers.delete('content-length')
    return new Response(upstream.body, { status: upstream.status, headers })
  },
})
console.log('koomerce-front on http://localhost:4100')
