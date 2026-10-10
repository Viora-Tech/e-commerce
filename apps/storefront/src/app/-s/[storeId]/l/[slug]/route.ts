import { followShortLink } from '@commerce/core'
import {
  attributionFromVisit,
  compactAttribution,
  decodeAttribution,
  encodeAttribution,
  pickAttribution,
  shortLinkTarget,
} from '@commerce/core/marketing'
import { CONSENT_COOKIE } from '@commerce/core/preferences'
import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE,
  LINK_CLICK_COOKIE,
  MARKETING_CLICK_MAX_AGE,
} from '@/lib/attribution-cookie'
import { analyticsAllowed } from '@/lib/consent-cookie'
import { requestOrigin } from '@/lib/seo'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string; slug: string }> }

// Every click is counted and answered fresh, never from a cache.
export const dynamic = 'force-dynamic'

/**
 * A short link from Growth → Links. Counts the click (not for bots or link previews), sends
 * the shopper to the link's page with its UTM tags, and marks the visit with the link so an
 * order from it is credited: a short-lived `wc_lk` cookie the page beacon reads, and, with
 * analytics consent, the attribution cookie itself. An unknown slug goes to the home page.
 */
export async function GET(request: Request, { params }: Params) {
  const { storeId, slug } = await params
  const h = await headers()
  const origin = await requestOrigin()
  let link: Awaited<ReturnType<typeof followShortLink>> = null
  try {
    link = await inStore(storeId, (tx) =>
      followShortLink(tx, storeId, slug, {
        userAgent: h.get('user-agent'),
        method: request.method,
      }),
    )
  } catch (err) {
    console.warn('[links] could not follow a short link', err)
  }
  if (!link) return NextResponse.redirect(new URL('/', origin), 302)

  const target = shortLinkTarget(link.destination, link, origin)
  const response = NextResponse.redirect(target, 302)
  response.headers.set('cache-control', 'no-store')
  const secure = target.protocol === 'https:'
  const cookie = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/' }
  response.cookies.set(LINK_CLICK_COOKIE, link.id, { ...cookie, maxAge: MARKETING_CLICK_MAX_AGE })
  const jar = await cookies()
  if (analyticsAllowed(jar.get(CONSENT_COOKIE)?.value)) {
    const current = attributionFromVisit({
      landingUrl: target.href,
      referrer: h.get('referer'),
      storeHost: h.get('host'),
      linkId: link.id,
    })
    const previous = decodeAttribution(jar.get(ATTRIBUTION_COOKIE)?.value)
    response.cookies.set(
      ATTRIBUTION_COOKIE,
      encodeAttribution(compactAttribution(pickAttribution(current, previous))),
      { ...cookie, maxAge: ATTRIBUTION_MAX_AGE },
    )
  }
  return response
}
