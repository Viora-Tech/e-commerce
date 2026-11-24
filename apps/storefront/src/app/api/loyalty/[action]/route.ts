import { cookies, headers } from 'next/headers'
import type { NextRequest } from 'next/server'
import { currentCustomer } from '@/lib/customer-session'
import { applyDiscountAction } from '@/lib/discount-actions'
import { LOYALTY_REF_COOKIE, loyaltyRefCode, loyaltyRefCookieOptions } from '@/lib/loyalty-referral'
import {
  LoyaltyRefused,
  loyaltyClaim,
  loyaltyRedeem,
  loyaltyReferralFor,
  loyaltyVisit,
} from '@/lib/loyalty-shopper'
import { loyaltyEarnFor, loyaltyViewFor } from '@/lib/loyalty-view'
import { clientIp, rateLimited } from '@/lib/rate-limit'
import { withEvlog } from '@/lib/request-log'
import { requestOrigin } from '@/lib/seo'

type Params = { params: Promise<{ action: string }> }

/** Per IP: claims, clicks and pings from one shopper are a handful a minute. */
const LOYALTY_POST_RULE = { limit: 30, windowMs: 60_000 }

const PRIVATE = { 'cache-control': 'private, no-store' }

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: PRIVATE })
const missing = () => json({ error: 'not_found' }, 404)

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const b = (await request.json()) as unknown
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const text = (v: unknown, max = 100) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A row id from the body, or '' (never a string the database would refuse). */
const idOf = (v: unknown) => {
  const t = text(v, 64)
  return UUID.test(t) ? t : ''
}

/**
 * The Loyalty points widget's endpoints (`@commerce/blocks/loyalty`'s `loyalty-client.ts`), on
 * the store the proxy resolved (`x-store-id`), for the signed-in shopper of the session cookie.
 * GET `state` (`?cart=1` adds the cart) and `earn`; POST `visit`, `redeem`, `claim`, `apply`
 * and `referral`. Never cached; 404 without the app.
 */
export const GET = withEvlog(async (request: NextRequest, { params }: Params) => {
  const storeId = (await headers()).get('x-store-id')
  if (!storeId) return missing()
  const { action } = await params
  if (action === 'state') {
    const cart = request.nextUrl.searchParams.get('cart') === '1'
    const view = await loyaltyViewFor(storeId, await requestOrigin(), { cart })
    return view ? json(view) : missing()
  }
  if (action === 'earn') {
    const info = await loyaltyEarnFor(storeId)
    return info ? json(info) : missing()
  }
  return missing()
})

export const POST = withEvlog(async (request: NextRequest, { params }: Params) => {
  const h = await headers()
  const storeId = h.get('x-store-id')
  const origin = request.headers.get('origin')
  // Same site only: another site cannot spend a shopper's points from its page.
  if (!storeId || (origin && !origin.endsWith(`//${h.get('host')}`))) return missing()
  const limited = await rateLimited('loyalty:ip', clientIp(h), LOYALTY_POST_RULE)
  if (!limited.ok) return json({ error: 'rate_limited' }, 429)
  const { action } = await params
  const input = await body(request)
  const me = await currentCustomer(storeId)
  if (action === 'referral') {
    const code = loyaltyRefCode(text(input.code))
    if (!code) return json({ error: 'invalid' }, 400)
    if (!me) {
      // The shopper asked for the friend's reward: keep the code until they sign in.
      const secure = request.nextUrl.protocol === 'https:'
      ;(await cookies()).set(LOYALTY_REF_COOKIE, code, loyaltyRefCookieOptions(secure))
      return json({ status: 'signin', code: null })
    }
    return json(await loyaltyReferralFor(storeId, me.id, code))
  }
  if (action === 'apply') {
    const code = text(input.code, 64)
    if (!code) return json({ ok: false }, 400)
    const r = await applyDiscountAction(code)
    return json({ ok: r.ok })
  }
  if (!me) return json({ error: 'signed_out' }, 401)
  try {
    if (action === 'visit') {
      const r = await loyaltyVisit(storeId, me.id)
      return r ? json(r) : missing()
    }
    if (action === 'redeem') {
      const rewardId = idOf(input.rewardId)
      if (!rewardId) return json({ error: 'invalid' }, 400)
      const points = typeof input.points === 'number' ? Math.floor(input.points) : null
      return json(await loyaltyRedeem(storeId, me.id, rewardId, points))
    }
    if (action === 'claim') {
      const ruleId = idOf(input.ruleId)
      if (!ruleId) return json({ error: 'invalid' }, 400)
      return json(await loyaltyClaim(storeId, me.id, ruleId))
    }
  } catch (err) {
    if (err instanceof LoyaltyRefused) return json({ error: err.reason }, 409)
    throw err
  }
  return missing()
})
