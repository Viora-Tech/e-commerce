import { suggestProducts } from '@commerce/core'
import { listCardProducts } from '@/lib/catalog'
import { lockedOut } from '@/lib/lock-gate'
import { clientIp, rateLimited, retryAfterSeconds } from '@/lib/rate-limit'
import { withEvlog } from '@/lib/request-log'
import { inStore } from '@/lib/store-context'
import {
  ACCESS_COOKIE,
  hasAccess,
  PREVIEW_COOKIE,
  readPreview,
  storefrontLock,
} from '@/lib/storefront-gate'
import type { Suggestion } from '@/lib/suggestion'

/** Generous: this is autocomplete-as-you-type, so a real shopper fires it often. */
const SUGGEST_IP_RULE = { limit: 60, windowMs: 60_000 }

/**
 * Predictive search for the header: a handful of products as the shopper types.
 * The store is the proxy's `x-store-id`; results are short-lived cacheable JSON.
 */
export const GET = withEvlog(async (request: Request) => {
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
  // `/api/*` skips the proxy's password page: a locked store's catalogue stays private here too.
  const lock = await storefrontLock(storeId)
  const cookie = (name: string) =>
    request.headers
      .get('cookie')
      ?.split(/;\s*/)
      .find((c) => c.startsWith(`${name}=`))
      ?.slice(name.length + 1)
  const passes = {
    access: lock.enabled && hasAccess(storeId, lock.password, cookie(ACCESS_COOKIE)),
    preview: !!readPreview(storeId, cookie(PREVIEW_COOKIE)),
  }
  if (lockedOut(lock, passes)) return Response.json([])
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
    // A pre-order still sells past zero stock: not "Sold out" in the dropdown.
    available: p.available > 0 || Boolean(p.preorder),
    // The result row draws a 3rem thumbnail: the smallest generated variant, not the original.
    image: p.images[0]
      ? { url: p.images[0].variants?.['320']?.webp ?? p.images[0].url, alt: p.images[0].alt }
      : null,
  }))
  return Response.json(body, {
    headers: { 'cache-control': 'public, max-age=30, stale-while-revalidate=60' },
  })
})
