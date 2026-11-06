import { recordCookieBannerShown } from '@commerce/core'
import { headers } from 'next/headers'
import { clientIp, rateLimited } from '@/lib/rate-limit'
import { withEvlog } from '@/lib/request-log'
import { inStore } from '@/lib/store-context'

/** One count per browser tab; this only stops floods. */
const SHOWN_IP_RULE = { limit: 60, windowMs: 60_000 }

const done = () => new Response(null, { status: 204 })

/**
 * The cookie banner was shown. A plain daily count with no cookie, no visitor and no address
 * kept, so it needs no consent and tells the store how many shoppers never answer the banner.
 */
export const POST = withEvlog(async (request: Request) => {
  const h = await headers()
  const storeId = h.get('x-store-id')
  const origin = request.headers.get('origin')
  if (!storeId || (origin && !origin.endsWith(`//${h.get('host')}`))) return done()
  const limited = await rateLimited('consent-shown:ip', clientIp(h), SHOWN_IP_RULE)
  if (!limited.ok) return done()
  await inStore(storeId, (tx) => recordCookieBannerShown({ tx, storeId }))
  return done()
})
