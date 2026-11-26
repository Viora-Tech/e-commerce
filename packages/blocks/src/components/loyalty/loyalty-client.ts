/** SOURCE OF TRUTH: the loyalty widget's calls to the storefront — WHAT: one shared read of the shopper's loyalty view (and the light earn read) per page, and the actions (claim a reward, apply a code, click through a way to earn, the daily visit, a friend's referral) on `/api/loyalty/*` / WHY: the launcher's panel, the blocks and the Points page share one fetch instead of each asking again */
import type {
  LoyaltyEarnInfo,
  LoyaltyRedeemed,
  LoyaltyRewardView,
  LoyaltyView,
} from './loyalty-types'

const BASE = '/api/loyalty'

/** The referral pop-up keeps the email typed there; the sign-in form starts with it (this tab only). */
export const LOYALTY_SIGNIN_EMAIL_KEY = 'kl-signin-email'

let viewRead: Promise<LoyaltyView | null> | null = null
let viewWithCart = false
let earnRead: Promise<LoyaltyEarnInfo | null> | null = null

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}/${path}`, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}/${path}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** The shopper's loyalty view, read once per page (again after `forgetLoyaltyView`). */
export function loadLoyaltyView(opts: { cart?: boolean } = {}): Promise<LoyaltyView | null> {
  if (viewRead && (viewWithCart || !opts.cart)) return viewRead
  viewWithCart = Boolean(opts.cart)
  viewRead = getJson<LoyaltyView>(opts.cart ? 'state?cart=1' : 'state').then((v) => {
    if (!v) viewRead = null
    return v
  })
  return viewRead
}

/** After a change (a claim, a code applied): the next read asks the store again. */
export function forgetLoyaltyView(): void {
  viewRead = null
}

/** The earn rate and tier multiplier, for points next to prices. */
export function loadEarnInfo(): Promise<LoyaltyEarnInfo | null> {
  if (!earnRead) {
    earnRead = getJson<LoyaltyEarnInfo>('earn').then((v) => {
      if (!v) earnRead = null
      return v
    })
  }
  return earnRead
}

export function redeemReward(rewardId: string, points?: number): Promise<LoyaltyRedeemed | null> {
  forgetLoyaltyView()
  return postJson<LoyaltyRedeemed>('redeem', { rewardId, points: points ?? null })
}

export function applyLoyaltyCode(code: string): Promise<{ ok: boolean } | null> {
  return postJson<{ ok: boolean }>('apply', { code })
}

/**
 * The cart box's "Redeem and apply": claims the reward (a custom amount at `points`), then puts
 * its code on the cart. The code when both worked; null when the claim failed, gave no code
 * (store credit) or the cart refused it. No new pricing: the same two calls as the panel.
 */
export async function redeemAndApply(
  reward: Pick<LoyaltyRewardView, 'id'>,
  points?: number,
): Promise<string | null> {
  const done = await redeemReward(reward.id, points)
  if (!done?.code) return null
  const applied = await applyLoyaltyCode(done.code)
  return applied?.ok ? done.code : null
}

/** A social or Google review rule: credits the points, answers the link to open. */
export function claimWayToEarn(ruleId: string): Promise<{ url: string; points: number } | null> {
  forgetLoyaltyView()
  return postJson<{ url: string; points: number }>('claim', { ruleId })
}

/** The daily visit (and sign-up points, a waiting referral) for a signed-in shopper. */
export function recordLoyaltyVisit(): Promise<{ points: number } | null> {
  return postJson<{ points: number }>('visit', {})
}

export type ReferralAnswer = {
  status: 'signin' | 'ready' | 'points' | 'refused' | 'off'
  code: string | null
}

/** A friend's referral link: keeps the code, and gives the friend their reward once signed in. */
export function claimReferral(code: string): Promise<ReferralAnswer | null> {
  forgetLoyaltyView()
  return postJson<ReferralAnswer>('referral', { code })
}
