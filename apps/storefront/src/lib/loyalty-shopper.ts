import 'server-only'
import type { LoyaltyRedeemed, ReferralAnswer } from '@commerce/blocks/loyalty'
import {
  attachReferral,
  claimActionRule,
  grantSignupPoints,
  LoyaltyError,
  loyaltyState,
  recordVisit,
  redeemReward,
} from '@commerce/core'
import { loyaltyRedemption, order, type StoreTx } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { LOYALTY_REF_COOKIE, loyaltyRefCode } from './loyalty-referral'
import { inStore } from './store-context'

/** A loyalty refusal the shopper can be told about (not enough points, sold out, ...). */
export class LoyaltyRefused extends Error {
  constructor(readonly reason: string) {
    super(reason)
  }
}

async function settingsIfInstalled(tx: StoreTx, storeId: string) {
  const state = await loyaltyState(tx, storeId)
  return state.installed ? state.settings : null
}

/** The friend code kept from a member's link, forgotten once used. */
async function takeRefCookie(): Promise<string | null> {
  const jar = await cookies()
  const code = loyaltyRefCode(jar.get(LOYALTY_REF_COOKIE)?.value)
  if (code) jar.delete(LOYALTY_REF_COOKIE)
  return code
}

/**
 * Once a day per signed-in shopper (the widget's ping, the Points page): the daily visit and
 * streak, sign-up points (once ever), and the referral a kept friend link waits to attach.
 */
export async function loyaltyVisit(storeId: string, customerId: string) {
  const code = await takeRefCookie()
  return inStore(storeId, async (tx) => {
    const settings = await settingsIfInstalled(tx, storeId)
    if (!settings) return null
    const ctx = { storeId, tx }
    const visit = await recordVisit(ctx, customerId, settings)
    await grantSignupPoints(ctx, customerId, settings)
    if (code) await attachReferral(ctx, { friendId: customerId, code }, settings)
    return { points: visit.points }
  })
}

/** After checkout: a friend who checked out (signed in or not) with a kept link is attached. */
export async function attachReferralAfterOrder(storeId: string, orderId: string): Promise<void> {
  const code = await takeRefCookie()
  if (!code) return
  await inStore(storeId, async (tx) => {
    const settings = await settingsIfInstalled(tx, storeId)
    if (!settings) return
    const [o] = await tx
      .select({ customerId: order.customerId })
      .from(order)
      .where(eq(order.id, orderId))
    if (!o?.customerId) return
    await attachReferral({ storeId, tx }, { friendId: o.customerId, code }, settings)
  }).catch((err) => logger.warn('could not attach a loyalty referral', { storeId, error: err }))
}

/** The Claim button: the reward's code (or store credit). Refusals become `LoyaltyRefused`. */
export async function loyaltyRedeem(
  storeId: string,
  customerId: string,
  rewardId: string,
  points: number | null,
): Promise<LoyaltyRedeemed> {
  try {
    return await inStore(storeId, async (tx) => {
      const settings = await settingsIfInstalled(tx, storeId)
      if (!settings) throw new LoyaltyRefused('closed')
      const r = await redeemReward({ storeId, tx }, { customerId, rewardId, points }, settings)
      return {
        id: r.id,
        title: r.title,
        code: r.code,
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
        rewardType: r.rewardType,
      }
    })
  } catch (err) {
    if (err instanceof LoyaltyError) throw new LoyaltyRefused(err.reason)
    throw err
  }
}

/** A follow or review button: the points for it (0 when already earned) and the link. */
export async function loyaltyClaim(storeId: string, customerId: string, ruleId: string) {
  try {
    return await inStore(storeId, async (tx) => {
      const settings = await settingsIfInstalled(tx, storeId)
      if (!settings) throw new LoyaltyRefused('closed')
      return claimActionRule({ storeId, tx }, customerId, ruleId, settings)
    })
  } catch (err) {
    if (err instanceof LoyaltyError) throw new LoyaltyRefused(err.reason)
    throw err
  }
}

/** The Referral pop-up's "Get my reward" for a signed-in shopper. */
export async function loyaltyReferralFor(
  storeId: string,
  customerId: string,
  code: string,
): Promise<ReferralAnswer> {
  return inStore(storeId, async (tx) => {
    const settings = await settingsIfInstalled(tx, storeId)
    if (!settings) return { status: 'off', code: null }
    const row = await attachReferral({ storeId, tx }, { friendId: customerId, code }, settings)
    if (!row) return { status: 'off', code: null }
    if (row.status === 'rejected') return { status: 'refused', code: null }
    if (!row.friendRedemptionId) return { status: 'points', code: null }
    const [r] = await tx
      .select({ code: loyaltyRedemption.code })
      .from(loyaltyRedemption)
      .where(eq(loyaltyRedemption.id, row.friendRedemptionId))
    return { status: 'ready', code: r?.code ?? null }
  })
}
