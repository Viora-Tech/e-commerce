import { loadEnv } from '@commerce/config'
import { CONSENT_COOKIE, currentConsent, decodeConsent } from '@commerce/core/consent'
import {
  collectorStore,
  collectPixelEvent,
  FB_COOKIE_MAX_AGE,
  FBC_COOKIE,
  FBP_COOKIE,
  firstPartyIds,
  PIXEL_BEACON_MAX_BYTES,
  type PixelStorefrontSendJob,
  parsePixelBeacon,
  sendJobOptions,
} from '@commerce/core/pixels/server'
import { logger } from '@commerce/observability/logging'
import { pixelSendQueue } from '@commerce/queue'
import { cookies, headers } from 'next/headers'
import { readCartId } from '@/lib/cart-cookie'
import { clientIp, rateLimited } from '@/lib/rate-limit'
import { withEvlog } from '@/lib/request-log'
import { inStore } from '@/lib/store-context'
import { parseVisitorId, VISITOR_COOKIE } from '@/lib/visitor-cookie'

/** A shopper browsing quickly sends a handful a page; this only stops floods. */
const PX_IP_RULE = { limit: 120, windowMs: 60_000 }

const done = () => new Response(null, { status: 204 })

async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length') ?? 0) > PIXEL_BEACON_MAX_BYTES) return null
  try {
    const text = await request.text()
    return text.length > PIXEL_BEACON_MAX_BYTES ? null : JSON.parse(text)
  } catch {
    return null
  }
}

/** The beacon comes from the store's own pages: a cross-site Origin is refused. */
function sameOrigin(request: Request, host: string | null): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/**
 * The Pixels app's first-party collector, the twin of `/api/beacon`. With the app installed and
 * marketing consent on the store's current banner, it keeps the shopper's `_fbp` / `_fbc` as
 * first-party cookies (390 days, set by our server so Safari's 7-day cap on script cookies does
 * not apply), stamps the cart's tracking for the server Purchase, and queues the server copy of
 * the event for each pixel with a token. Without consent nothing is kept. It never waits on Meta.
 */
export const POST = withEvlog(async (request: Request) => {
  const h = await headers()
  const storeId = h.get('x-store-id')
  if (!storeId || !sameOrigin(request, h.get('host'))) return done()
  const ip = clientIp(request.headers)
  if (!(await rateLimited('pixels-collect:ip', ip, PX_IP_RULE)).ok) return done()
  const beacon = parsePixelBeacon(await readBody(request))
  if (!beacon) return done()

  const jar = await cookies()
  const stored = decodeConsent(jar.get(CONSENT_COOKIE)?.value)
  const store = await inStore(storeId, (tx) => collectorStore(tx, storeId))
  const consent = currentConsent(stored, store.bannerVersion)
  if (!store.installed || !stored || !consent?.marketing) return done()

  const now = new Date()
  const ids = firstPartyIds(
    { fbp: jar.get(FBP_COOKIE)?.value, fbc: jar.get(FBC_COOKIE)?.value },
    beacon.url,
    now,
    Math.random(),
  )
  const secure = new URL(request.url).protocol === 'https:'
  // Read by Meta's own script too, so not httpOnly (as Meta sets them).
  const cookieOpts = {
    httpOnly: false,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: FB_COOKIE_MAX_AGE,
  }
  if (ids.set.includes('fbp')) jar.set(FBP_COOKIE, ids.fbp, cookieOpts)
  if (ids.set.includes('fbc') && ids.fbc) jar.set(FBC_COOKIE, ids.fbc, cookieOpts)

  const ua = request.headers.get('user-agent')?.slice(0, 500) ?? undefined
  const tracking = {
    fbp: ids.fbp,
    ...(ids.fbc ? { fbc: ids.fbc, fbclid: ids.fbclid ?? undefined } : {}),
    ...(ip && ip !== 'unknown' ? { ip } : {}),
    ...(ua ? { ua } : {}),
    ...(beacon.url ? { landingUrl: beacon.url } : {}),
    consent: {
      marketing: consent.marketing,
      analytics: consent.analytics,
      version: stored.version,
      at: now.toISOString(),
    },
  }
  try {
    const cartId = await readCartId()
    const visitorId = parseVisitorId(jar.get(VISITOR_COOKIE)?.value)
    const jobs: PixelStorefrontSendJob[] = await inStore(storeId, (tx) =>
      collectPixelEvent(tx, { storeId, beacon, cartId, visitorId, tracking, now }),
    )
    if (jobs.length) {
      const queue = pixelSendQueue(loadEnv(process.env).REDIS_URL)
      for (const job of jobs) await queue.add('send', job, sendJobOptions(job))
    }
  } catch (err) {
    // A lost pixel event never costs the shopper the page.
    logger.warn('could not collect a pixel event', { storeId, event: beacon.name, error: err })
  }
  return done()
})
