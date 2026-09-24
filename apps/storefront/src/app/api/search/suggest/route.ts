import { suggestProducts } from '@commerce/core'
import { listCardProducts } from '@/lib/catalog'
import { clientIp, rateLimited, retryAfterSeconds } from '@/lib/rate-limit'
import { inStore } from '@/lib/store-context'
import type { Suggestion } from '@/lib/suggestion'

/** Generous: this is autocomplete-as-you-type, so a real shopper fires it often. */
const SUGGEST_IP_RULE = { limit: 60, windowMs: 60_000 }

/**
 * Predictive search for the header: a handful of products as the shopper types.
 * The store is the proxy's `x-store-id`; results are short-lived cacheable JSON.
 */
export async function GET(request: Request) {
  const storeId = request.headers.get('x-store-id')
  if (!storeId) return new Response(null, { status: 404 })
  const ip = clientIp(request.headers)
  const limit = await rateLimited('search-suggest:ip', ip, SUGGEST_IP_RULE)
  if (!limit.ok) {
    return Response.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds(limit)) } },
    )
  }
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 100)
  const products = await inStore(storeId, async (tx) => {
    const handles = await suggestProducts(tx, q)
    return listCardProducts(tx, handles.length, undefined, handles)
  })
  const body: Suggestion[] = products.map((p) => ({
    handle: p.handle,
    title: p.title,
    vendor: p.vendor,
    pricePaise: p.pricePaise,
    mrpPaise: p.mrpPaise,
    available: p.available > 0,
    image: p.images[0] ? { url: p.images[0].url, alt: p.images[0].alt } : null,
  }))
  return Response.json(body, {
    headers: { 'cache-control': 'public, max-age=30, stale-while-revalidate=60' },
  })
}
