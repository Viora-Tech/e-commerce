import 'server-only'
import { isBotUserAgent } from '@commerce/core/marketing'
import { CONSENT_COOKIE } from '@commerce/core/preferences'
import { logger } from '@commerce/observability/logging'
import { affiliateState } from '@commerce/plugin-affiliates/server'
import type { NextRequest, NextResponse } from 'next/server'
import { countAffiliateClick } from './affiliates'
import { REFERRAL_COOKIE } from './attribution-cookie'
import { consentOf } from './consent-cookie'
import { LOYALTY_REF_COOKIE, loyaltyRefCookieOptions, loyaltyRefLanding } from './loyalty-referral'
import { isPrefetch, referralClick } from './referral-click'
import { inStore } from './store-context'

/** The store's link window is read at most once per this long per process. */
const TTL_MS = 30_000
const MAX_ENTRIES = 5_000
const DAY_SECONDS = 86_400

const windows = new Map<string, { days: number | null; expiresAt: number }>()

/** The store's affiliate link window in days, or null when it does not have the Affiliates app. */
async function linkWindowDays(storeId: string): Promise<number | null> {
  const hit = windows.get(storeId)
  if (hit && hit.expiresAt > Date.now()) return hit.days
  const { installed, settings } = await inStore(storeId, (tx) => affiliateState(tx, storeId))
  const days = installed ? settings.cookieDays : null
  if (windows.size >= MAX_ENTRIES) {
    const oldest = windows.keys().next().value
    if (oldest !== undefined) windows.delete(oldest)
  }
  windows.set(storeId, { days, expiresAt: Date.now() + TTL_MS })
  return days
}

/**
 * Sets the referral cookie (`<code>.<click time>`) for the store's link window. False when the
 * store does not have the Affiliates app.
 */
export async function setReferralCookie(
  storeId: string,
  response: NextResponse,
  cookie: string,
  secure: boolean,
): Promise<boolean> {
  const days = await linkWindowDays(storeId)
  if (days === null) return false
  response.cookies.set(REFERRAL_COOKIE, cookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: days * DAY_SECONDS,
  })
  return true
}

/**
 * An affiliate link landing (`?ref=`): counts the click and, once marketing is allowed (a yes on
 * the banner, or at once where the banner does not ask), sets the referral cookie for the store's link window (owner, 12 Nov 2026).
 * Without that yes the banner keeps the landing in the tab and sets the cookie on a later yes
 * (`lib/referral-pending.ts`, `/api/referral`). The count is a per-affiliate daily total and
 * needs no consent. Runs in the proxy; never fails the page.
 */
export async function noteReferral(
  storeId: string,
  request: NextRequest,
  response: NextResponse,
): Promise<void> {
  // A yes on the banner, or a region where the banner does not ask (Shopify's model).
  const { consent } = await consentOf(
    storeId,
    request.headers,
    request.cookies.get(CONSENT_COOKIE)?.value,
  )
  const marketing = consent?.marketing === true
  // A Loyalty points member's link uses the same `?ref=`: kept apart, for the friend's reward.
  const loyaltyCode = loyaltyRefLanding({
    param: request.nextUrl.searchParams.get('ref'),
    existing: request.cookies.get(LOYALTY_REF_COOKIE)?.value,
    method: request.method,
    prefetch: isPrefetch(request.headers),
    bot: isBotUserAgent(request.headers.get('user-agent')),
    marketing,
  })
  if (loyaltyCode) {
    const secure = request.nextUrl.protocol === 'https:'
    response.cookies.set(LOYALTY_REF_COOKIE, loyaltyCode, loyaltyRefCookieOptions(secure))
  }
  const click = referralClick({
    param: request.nextUrl.searchParams.get('ref'),
    existing: request.cookies.get(REFERRAL_COOKIE)?.value,
    method: request.method,
    userAgent: request.headers.get('user-agent'),
    prefetch: isPrefetch(request.headers),
    marketing,
    now: new Date(),
  })
  if (!click) return
  try {
    const secure = request.nextUrl.protocol === 'https:'
    const installed = click.cookie
      ? await setReferralCookie(storeId, response, click.cookie, secure)
      : (await linkWindowDays(storeId)) !== null
    if (!installed) return
    if (click.count) await inStore(storeId, (tx) => countAffiliateClick(tx, storeId, click.code))
  } catch (err) {
    logger.warn('could not note an affiliate link click', { storeId, error: err })
  }
}
