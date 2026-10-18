import { loadEnv } from '@commerce/config'
import {
  type Attribution,
  attributionFromVisit,
  compactAttribution,
  decodeAttribution,
  encodeAttribution,
  pickAttribution,
  recordMarketingSession,
  setCartAttribution,
} from '@commerce/core'
import { CONSENT_COOKIE } from '@commerce/core/preferences'
import { logger } from '@commerce/observability/logging'
import { recordVisit, sharedRedis } from '@commerce/queue'
import { cookies, headers } from 'next/headers'
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE,
  decodeLinkClick,
  decodeMarketingClick,
  LINK_CLICK_COOKIE,
  MARKETING_CLICK_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from '@/lib/attribution-cookie'
import { readCartId } from '@/lib/cart-cookie'
import { analyticsAllowed } from '@/lib/consent-cookie'
import { withEvlog } from '@/lib/request-log'
import { inStore } from '@/lib/store-context'
import { parseVisitorId, VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE } from '@/lib/visitor-cookie'

type BeaconBody = { href?: unknown; referrer?: unknown }

async function readBody(request: Request): Promise<{ href: string; referrer: string | null }> {
  try {
    const body = (await request.json()) as BeaconBody
    return {
      href: typeof body.href === 'string' ? body.href.slice(0, 2000) : '',
      referrer: typeof body.referrer === 'string' ? body.referrer.slice(0, 2000) : null,
    }
  } catch {
    return { href: '', referrer: null }
  }
}

/** A tagged landing starts a new session even inside an open one, as GA and Shopify do. */
function hasCampaignSignal(href: string): boolean {
  try {
    const p = new URL(href).searchParams
    return p.has('utm_source') || p.has('utm_medium') || p.has('utm_campaign') || p.has('gclid')
  } catch {
    return false
  }
}

function sameTouch(a: Attribution, b: Attribution): boolean {
  return (
    a.channel === b.channel &&
    a.source === b.source &&
    a.medium === b.medium &&
    a.campaign === b.campaign
  )
}

/**
 * Page-view beacon. Counts the visitor for the live and daily cards, and at
 * the start of a session records where it came from (UTM tags, referrer or a
 * tracked marketing link) for Marketing reports and order attribution. The
 * proxy derives `x-store-id` from the host and mints the visitor cookie, so
 * the body only supplies the page URL and document.referrer.
 */
export const POST = withEvlog(async (request: Request) => {
  const h = await headers()
  const jar = await cookies()
  const storeId = h.get('x-store-id')
  // No analytics consent, no counting: the banner gates the beacon, and so does the server.
  if (!storeId || !analyticsAllowed(jar.get(CONSENT_COOKIE)?.value)) {
    return new Response(null, { status: 204 })
  }
  const secure = new URL(request.url).protocol === 'https:'
  let visitorId = parseVisitorId(jar.get(VISITOR_COOKIE)?.value)
  if (!visitorId) {
    // Consent was just given on this page, before the proxy could mint the id.
    visitorId = crypto.randomUUID()
    jar.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: VISITOR_COOKIE_MAX_AGE,
    })
  }

  await recordVisit(sharedRedis(loadEnv(process.env).REDIS_URL), storeId, visitorId)

  const { href, referrer } = await readBody(request)
  const click = decodeMarketingClick(jar.get(MARKETING_CLICK_COOKIE)?.value)
  const linkId = decodeLinkClick(jar.get(LINK_CLICK_COOKIE)?.value)
  const inSession = Boolean(jar.get(SESSION_COOKIE)?.value)
  jar.set(SESSION_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  if (inSession && !click && !linkId && !hasCampaignSignal(href)) {
    return new Response(null, { status: 204 })
  }

  const current = attributionFromVisit({
    landingUrl: href || request.url,
    referrer,
    storeHost: h.get('host'),
    ...(click ? { marketing: click } : {}),
    ...(linkId ? { linkId } : {}),
  })
  const previous = decodeAttribution(jar.get(ATTRIBUTION_COOKIE)?.value)
  // Reloading a tagged page inside a live session is the same session, not a new one.
  if (inSession && !click && !linkId && previous && sameTouch(current, previous)) {
    return new Response(null, { status: 204 })
  }
  const picked = compactAttribution(pickAttribution(current, previous))
  const cartId = await readCartId()
  try {
    await inStore(storeId, async (tx) => {
      await recordMarketingSession(tx, storeId, { visitorId, attribution: current })
      if (cartId) await setCartAttribution(tx, cartId, picked)
    })
  } catch (err) {
    // A lost session row costs a report line, never the page view.
    logger.warn('could not record the marketing session', { storeId, error: err })
  }
  jar.set(ATTRIBUTION_COOKIE, encodeAttribution(picked), {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: ATTRIBUTION_MAX_AGE,
  })
  if (click) jar.delete(MARKETING_CLICK_COOKIE)
  if (linkId) jar.delete(LINK_CLICK_COOKIE)
  return new Response(null, { status: 204 })
})
