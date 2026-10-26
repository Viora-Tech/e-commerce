import 'server-only'
import { logger } from '@commerce/observability/logging'
import { affiliateState } from '@commerce/plugin-affiliates/server'
import type { NextRequest, NextResponse } from 'next/server'
import { countAffiliateClick } from './affiliates'
import { REFERRAL_COOKIE } from './attribution-cookie'
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
 * An affiliate link landing (`?ref=`): sets the referral cookie for the store's link window and
 * counts the click. Runs in the proxy, whatever the consent banner says: the cookie holds the
 * code and click time only (functional, so the affiliate earns on the sale) and the count is a
 * per-affiliate daily total. Never fails the page.
 */
export async function noteReferral(
  storeId: string,
  request: NextRequest,
  response: NextResponse,
): Promise<void> {
  const click = referralClick({
    param: request.nextUrl.searchParams.get('ref'),
    existing: request.cookies.get(REFERRAL_COOKIE)?.value,
    method: request.method,
    userAgent: request.headers.get('user-agent'),
    prefetch: isPrefetch(request.headers),
    now: new Date(),
  })
  if (!click) return
  try {
    const days = await linkWindowDays(storeId)
    if (days === null) return
    response.cookies.set(REFERRAL_COOKIE, click.cookie, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: days * DAY_SECONDS,
    })
    if (click.count) await inStore(storeId, (tx) => countAffiliateClick(tx, storeId, click.code))
  } catch (err) {
    logger.warn('could not note an affiliate link click', { storeId, error: err })
  }
}
