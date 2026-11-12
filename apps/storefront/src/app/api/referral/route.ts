import { decodeReferral } from '@commerce/core/marketing'
import { CONSENT_COOKIE } from '@commerce/core/preferences'
import { cookies, headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { REFERRAL_COOKIE } from '@/lib/attribution-cookie'
import { marketingAllowed } from '@/lib/consent-cookie'
import { clientIp, rateLimited } from '@/lib/rate-limit'
import { referralCookieFromPending } from '@/lib/referral-click'
import { setReferralCookie } from '@/lib/referral-landing'
import { withEvlog } from '@/lib/request-log'

/** A tab sends this once after a yes; this only stops floods. */
const REFERRAL_IP_RULE = { limit: 30, windowMs: 60_000 }

const done = () => new NextResponse(null, { status: 204 })

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

/**
 * The shopper said yes to marketing cookies after opening an affiliate link: the banner sends
 * the landing it kept in the tab (`lib/referral-pending.ts`), and the referral cookie is set
 * now, dated at the click. Nothing is set without the yes in the consent cookie, from another
 * site, or over a newer referral (last click wins). The click itself was counted on landing.
 */
export const POST = withEvlog(async (request: NextRequest) => {
  const h = await headers()
  const storeId = h.get('x-store-id')
  const origin = request.headers.get('origin')
  if (!storeId || (origin && !origin.endsWith(`//${h.get('host')}`))) return done()
  const jar = await cookies()
  if (!marketingAllowed(jar.get(CONSENT_COOKIE)?.value)) return done()
  const limited = await rateLimited('referral:ip', clientIp(h), REFERRAL_IP_RULE)
  if (!limited.ok) return done()
  const now = new Date()
  const cookie = referralCookieFromPending(await readBody(request), now)
  const pending = decodeReferral(cookie)
  if (!cookie || !pending) return done()
  const current = decodeReferral(jar.get(REFERRAL_COOKIE)?.value)
  if (current && current.at.getTime() >= pending.at.getTime()) return done()
  const response = done()
  await setReferralCookie(storeId, response, cookie, request.nextUrl.protocol === 'https:')
  return response
})
