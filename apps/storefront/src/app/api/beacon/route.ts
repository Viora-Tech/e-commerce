import { loadEnv, settingsSecret } from '@commerce/config'
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
import { isBotUserAgent, productHandleFromHref } from '@commerce/core/marketing'
import { CONSENT_COOKIE } from '@commerce/core/preferences'
import { dayKey } from '@commerce/dates'
import { logger } from '@commerce/observability/logging'
import { recordVisit, sharedRedis } from '@commerce/queue'
import { cookies, headers } from 'next/headers'
import { after } from 'next/server'
import {
  anonymousSessionKey,
  anonymousVisitorId,
  startsAnonymousSession,
  visitAddress,
} from '@/lib/anonymous-visit'
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
import { CUSTOMER_COOKIE } from '@/lib/customer-session'
import { parseDiscoveryEvent, recordBeaconDiscovery } from '@/lib/discovery-events'
import { recordShopperProductView } from '@/lib/product-view'
import { withEvlog } from '@/lib/request-log'
import { inStore } from '@/lib/store-context'
import { parseVisitorId, VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE } from '@/lib/visitor-cookie'

type BeaconBody = { href?: unknown; referrer?: unknown; discovery?: unknown }

async function readBody(
  request: Request,
): Promise<{ href: string; referrer: string | null; discovery: unknown }> {
  try {
    const body = (await request.json()) as BeaconBody
    return {
      href: typeof body.href === 'string' ? body.href.slice(0, 2000) : '',
      referrer: typeof body.referrer === 'string' ? body.referrer.slice(0, 2000) : null,
      discovery: body.discovery,
    }
  } catch {
    return { href: '', referrer: null, discovery: null }
  }
}

/** A tagged landing starts a new session even inside an open one, as GA and Shopify do. */
function hasCampaignSignal(href: string): boolean {
  try {
    const p = new URL(href).searchParams
    return (
      p.has('utm_source') ||
      p.has('utm_medium') ||
      p.has('utm_campaign') ||
      p.has('gclid') ||
      p.has('ref')
    )
  } catch {
    return false
  }
}

/** Today's cookieless id for this request, or null when shoppers cannot be told apart. */
function anonymousIdFor(h: Headers, storeId: string): string | null {
  const ip = visitAddress(h)
  if (!ip) return null
  return anonymousVisitorId({
    secret: settingsSecret(),
    day: dayKey(new Date()),
    storeId,
    ip,
    userAgent: h.get('user-agent') ?? '',
  })
}

/** A cookieless visit, counted as one session per 30 minutes of page views. */
async function countAnonymousVisit(
  request: Request,
  h: Headers,
  storeId: string,
  href: string,
  referrer: string | null,
): Promise<void> {
  const visitorId = anonymousIdFor(h, storeId)
  if (!visitorId) return
  try {
    const redis = sharedRedis(loadEnv(process.env).REDIS_URL)
    await recordVisit(redis, storeId, visitorId)
    const isNew = await startsAnonymousSession(
      redis,
      anonymousSessionKey(storeId, visitorId),
      hasCampaignSignal(href),
    )
    if (!isNew) return
    const attribution = attributionFromVisit({
      landingUrl: href || request.url,
      referrer,
      storeHost: h.get('host'),
    })
    await inStore(storeId, (tx) => recordMarketingSession(tx, storeId, { visitorId, attribution }))
  } catch (err) {
    // A lost visit costs a report line, never the page view.
    logger.warn('could not record the anonymous visit', { storeId, error: err })
  }
}

/** True when this browser's visit is already open as a cookieless one (said yes mid-visit). */
async function countedAnonymously(h: Headers, storeId: string): Promise<boolean> {
  const visitorId = anonymousIdFor(h, storeId)
  if (!visitorId) return false
  try {
    const redis = sharedRedis(loadEnv(process.env).REDIS_URL)
    return (await redis.exists(anonymousSessionKey(storeId, visitorId))) === 1
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
  if (!storeId) return new Response(null, { status: 204 })
  // No analytics consent: count the visit without cookies or ids (totals only), nothing else.
  if (!analyticsAllowed(jar.get(CONSENT_COOKIE)?.value)) {
    const { href, referrer, discovery } = await readBody(request)
    if (discovery === undefined && !isBotUserAgent(h.get('user-agent'))) {
      await countAnonymousVisit(request, h, storeId, href, referrer)
    }
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

  const { href, referrer, discovery } = await readBody(request)
  // A Search & discovery event (a search, a result or recommendation click, a row seen) rides
  // the same consent check but is no page view: written after the response, nothing else runs.
  if (discovery !== undefined) {
    const event = parseDiscoveryEvent(discovery)
    const visitor = visitorId
    if (event && !isBotUserAgent(h.get('user-agent'))) {
      after(() => recordBeaconDiscovery(request, storeId, visitor, event))
    }
    return new Response(null, { status: 204 })
  }

  await recordVisit(sharedRedis(loadEnv(process.env).REDIS_URL), storeId, visitorId)

  // Browse abandonment: a known shopper's product page view, written after the response.
  const viewedHandle = isBotUserAgent(h.get('user-agent')) ? null : productHandleFromHref(href)
  if (viewedHandle) {
    const customerToken = jar.get(CUSTOMER_COOKIE)?.value ?? null
    const viewCartId = await readCartId()
    after(() =>
      recordShopperProductView({
        storeId,
        handle: viewedHandle,
        customerToken,
        cartId: viewCartId,
      }),
    )
  }
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
  const alreadyCounted = await countedAnonymously(h, storeId)
  try {
    await inStore(storeId, async (tx) => {
      // A bot is no visit: it would count against the plan's fair-use visits for nothing.
      // Nor is the yes on the banner: a visit already counted without cookies stays one visit.
      if (!isBotUserAgent(h.get('user-agent')) && !alreadyCounted)
        await recordMarketingSession(tx, storeId, { visitorId, attribution: current })
      if (cartId) await setCartAttribution(tx, cartId, picked)
      // Affiliate link clicks are counted by the proxy, consent or not (`lib/referral-landing.ts`).
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
