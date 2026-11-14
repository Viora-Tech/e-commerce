import { CONSENT_COOKIE, currentConsent, decodeConsent } from '@commerce/core/consent'
import {
  browserMatchData,
  collectorStore,
  hashMatchValues,
  shopperMatchFacts,
} from '@commerce/core/pixels/server'
import { logger } from '@commerce/observability/logging'
import { cookies, headers } from 'next/headers'
import { readCartId } from '@/lib/cart-cookie'
import { currentCustomer } from '@/lib/customer-session'
import { clientIp, rateLimited } from '@/lib/rate-limit'
import { withEvlog } from '@/lib/request-log'
import { inStore } from '@/lib/store-context'
import { parseVisitorId, VISITOR_COOKIE } from '@/lib/visitor-cookie'

/** Once a page load; this only stops floods. */
const ME_IP_RULE = { limit: 60, windowMs: 60_000 }

const nothing = () =>
  new Response(null, { status: 204, headers: { 'cache-control': 'private, no-store' } })

/**
 * The Pixels app's manual advanced matching. After a yes to marketing the browser pixel asks
 * here before it initialises: the shopper's email, phone, name, city, state, PIN, country and
 * customer (or visitor) id, normalised Meta's way and SHA-256 hashed on the server, so no plain
 * value is ever put in the page or handed to fbevents.js. Without the app or without marketing
 * consent on the current banner it answers nothing (204), like `/api/px`.
 */
export const GET = withEvlog(async (request: Request) => {
  const h = await headers()
  const storeId = h.get('x-store-id')
  if (!storeId) return nothing()
  if (!(await rateLimited('pixels-match:ip', clientIp(request.headers), ME_IP_RULE)).ok) {
    return nothing()
  }
  const jar = await cookies()
  const stored = decodeConsent(jar.get(CONSENT_COOKIE)?.value)
  try {
    const store = await inStore(storeId, (tx) => collectorStore(tx, storeId))
    if (!store.installed || !currentConsent(stored, store.bannerVersion)?.marketing) {
      return nothing()
    }
    const [me, cartId] = await Promise.all([currentCustomer(storeId), readCartId()])
    const visitorId = parseVisitorId(jar.get(VISITOR_COOKIE)?.value)
    const facts = await inStore(storeId, (tx) =>
      shopperMatchFacts(tx, {
        customer: me ? { id: me.id, email: me.email, phone: me.phone, name: me.name } : null,
        cartId,
        visitorId,
      }),
    )
    const match = browserMatchData(hashMatchValues(facts))
    if (!match) return nothing()
    return Response.json({ match }, { headers: { 'cache-control': 'private, no-store' } })
  } catch (err) {
    // Matching is a bonus: the pixel starts without it.
    logger.warn('could not load pixel matching', { storeId, error: err })
    return nothing()
  }
})
