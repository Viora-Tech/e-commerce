/** SOURCE OF TRUTH: loyalty emails queue — WHAT: the template ids and data of the loyalty emails (points earned, reward redeemed, reward expiring 30 and 3 days, birthday, tier unlocked, points expiring 30 and 7 days), queueing each once per customer and dedupe key, finding the ones due, and marking them sent / WHY: core decides when a loyalty email is owed; the worker sends what is queued, so an email is never sent twice and a template not yet in packages/notifications simply waits */
import { customer, loyaltyEntry, loyaltyNotification, loyaltyRedemption } from '@commerce/db'
import { and, asc, eq, gt, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { storeCreditLastDay, storeCreditTimeZone } from '../customers/store-credit-expiry'
import { pointsSummary } from './ledger'
import {
  type LoyaltySettings,
  POINTS_EXPIRY_NOTICE_DAYS,
  REWARD_EXPIRY_NOTICE_DAYS,
} from './settings'

/**
 * Loyalty email template ids. `points_expiring` already exists in packages/notifications; the
 * others are new and need templates there (docs/loyalty-v2-interfaces.md, "Emails").
 */
export const LOYALTY_TEMPLATES = {
  pointsEarned: 'loyalty_points_earned',
  rewardRedeemed: 'loyalty_reward_redeemed',
  rewardExpiring: 'loyalty_reward_expiring',
  birthday: 'loyalty_birthday',
  tierUnlocked: 'loyalty_tier_unlocked',
  pointsExpiring: 'points_expiring',
} as const
export type LoyaltyTemplateId = (typeof LOYALTY_TEMPLATES)[keyof typeof LOYALTY_TEMPLATES]

/** What each email carries (beside the customer's name and email, read at send time). */
export type LoyaltyNotificationData = {
  loyalty_points_earned: { points: number; balancePoints: number; reason: string }
  loyalty_reward_redeemed: {
    title: string
    points: number
    code: string | null
    /** Last day the code works (`YYYY-MM-DD`, store time); null never. */
    lastDay: string | null
  }
  loyalty_reward_expiring: { title: string; code: string | null; lastDay: string; days: number }
  loyalty_birthday: { points: number }
  loyalty_tier_unlocked: { tierName: string; perks: string[]; rewardTitle: string | null }
  points_expiring: { expiringPoints: number; lastDay: string; balancePoints: number; days: number }
}

/** Queues one email; a second with the same customer and key is ignored. Returns whether it was new. */
export async function queueLoyaltyEmail<T extends LoyaltyTemplateId>(
  ctx: StoreContext,
  input: { customerId: string; template: T; dedupeKey: string; data: LoyaltyNotificationData[T] },
  now: Date = new Date(),
): Promise<boolean> {
  const rows = await ctx.tx
    .insert(loyaltyNotification)
    .values({
      storeId: ctx.storeId,
      customerId: input.customerId,
      template: input.template,
      dedupeKey: input.dedupeKey.slice(0, 200),
      data: input.data as Record<string, unknown>,
      createdAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: loyaltyNotification.id })
  return rows.length > 0
}

export type QueuedLoyaltyEmail = {
  id: string
  customerId: string
  email: string | null
  name: string | null
  template: LoyaltyTemplateId
  data: Record<string, unknown>
  createdAt: Date
}

/** Emails not sent yet, oldest first; `templates` narrows to the ones the worker can send. */
export async function unsentLoyaltyEmails(
  ctx: StoreContext,
  opts: { templates?: readonly LoyaltyTemplateId[]; limit?: number } = {},
): Promise<QueuedLoyaltyEmail[]> {
  const rows = await ctx.tx
    .select({
      id: loyaltyNotification.id,
      customerId: loyaltyNotification.customerId,
      email: customer.email,
      name: customer.name,
      template: loyaltyNotification.template,
      data: loyaltyNotification.data,
      createdAt: loyaltyNotification.createdAt,
    })
    .from(loyaltyNotification)
    .innerJoin(customer, eq(customer.id, loyaltyNotification.customerId))
    .where(
      and(
        isNull(loyaltyNotification.sentAt),
        opts.templates ? inArray(loyaltyNotification.template, [...opts.templates]) : undefined,
      ),
    )
    .orderBy(asc(loyaltyNotification.createdAt))
    .limit(opts.limit ?? 100)
  return rows as QueuedLoyaltyEmail[]
}

/** Marks queued emails sent (or skipped), so they never go again. */
export async function markLoyaltyEmailsSent(
  ctx: StoreContext,
  ids: string[],
  now: Date = new Date(),
): Promise<void> {
  if (ids.length === 0) return
  await ctx.tx
    .update(loyaltyNotification)
    .set({ sentAt: now })
    .where(and(inArray(loyaltyNotification.id, ids), isNull(loyaltyNotification.sentAt)))
}

const DAY_MS = 86_400_000

/**
 * Queues "points expiring" for customers whose points run out within 30 days, and again within
 * 7 (`POINTS_EXPIRY_NOTICE_DAYS`), once per window and last day. Off when the store's
 * `reminderDays` is 0. Returns how many were queued.
 */
export async function queuePointsExpiryEmails(
  ctx: StoreContext,
  settings: LoyaltySettings,
  now: Date = new Date(),
  limit = 200,
): Promise<number> {
  if (settings.reminderDays <= 0) return 0
  const widest = Math.max(...POINTS_EXPIRY_NOTICE_DAYS)
  const by = new Date(now.getTime() + widest * DAY_MS)
  const rows = await ctx.tx
    .selectDistinct({ customerId: loyaltyEntry.customerId })
    .from(loyaltyEntry)
    .where(
      and(
        eq(loyaltyEntry.status, 'credited'),
        gt(loyaltyEntry.points, 0),
        isNotNull(loyaltyEntry.expiresAt),
        gt(loyaltyEntry.expiresAt, now),
        lte(loyaltyEntry.expiresAt, by),
      ),
    )
    .limit(limit)
  let queued = 0
  for (const { customerId } of rows) {
    // The narrowest window the soonest points are inside: 7 days, else 30.
    for (const days of [...POINTS_EXPIRY_NOTICE_DAYS].sort((a, b) => a - b)) {
      const s = await pointsSummary(ctx, customerId, days, now)
      if (!s.expiringSoon) continue
      const made = await queueLoyaltyEmail(
        ctx,
        {
          customerId,
          template: 'points_expiring',
          dedupeKey: `points_expiring:${days}:${s.expiringSoon.lastDay}`,
          data: {
            expiringPoints: s.expiringSoon.points,
            lastDay: s.expiringSoon.lastDay,
            balancePoints: s.points,
            days,
          },
        },
        now,
      )
      if (made) queued += 1
      break
    }
  }
  return queued
}

/** Queues "reward expiring" for unused codes running out within 30 days, then within 3. */
export async function queueRewardExpiryEmails(
  ctx: StoreContext,
  now: Date = new Date(),
  limit = 200,
): Promise<number> {
  const widest = Math.max(...REWARD_EXPIRY_NOTICE_DAYS)
  const rows = await ctx.tx
    .select({
      id: loyaltyRedemption.id,
      customerId: loyaltyRedemption.customerId,
      title: loyaltyRedemption.title,
      code: loyaltyRedemption.code,
      expiresAt: loyaltyRedemption.expiresAt,
    })
    .from(loyaltyRedemption)
    .where(
      and(
        eq(loyaltyRedemption.status, 'issued'),
        isNotNull(loyaltyRedemption.code),
        gt(loyaltyRedemption.expiresAt, now),
        lte(loyaltyRedemption.expiresAt, new Date(now.getTime() + widest * DAY_MS)),
      ),
    )
    .limit(limit)
  if (rows.length === 0) return 0
  const timeZone = await storeCreditTimeZone(ctx)
  let queued = 0
  for (const r of rows) {
    if (!r.expiresAt) continue
    const left = (r.expiresAt.getTime() - now.getTime()) / DAY_MS
    // The narrowest window the code is inside: 3 days when 3 or fewer are left, else 30.
    const days = [...REWARD_EXPIRY_NOTICE_DAYS].sort((a, b) => a - b).find((d) => left <= d)
    if (!days) continue
    const made = await queueLoyaltyEmail(
      ctx,
      {
        customerId: r.customerId,
        template: 'loyalty_reward_expiring',
        dedupeKey: `reward_expiring:${days}:${r.id}`,
        data: {
          title: r.title,
          code: r.code,
          lastDay: storeCreditLastDay(r.expiresAt, timeZone),
          days,
        },
      },
      now,
    )
    if (made) queued += 1
  }
  return queued
}

/** How many queued emails per template are waiting, for the admin's Emails screen. */
export async function loyaltyEmailBacklog(ctx: StoreContext) {
  return ctx.tx
    .select({
      template: loyaltyNotification.template,
      waiting: sql<number>`count(*) filter (where ${loyaltyNotification.sentAt} is null)::int`,
      sent: sql<number>`count(*) filter (where ${loyaltyNotification.sentAt} is not null)::int`,
    })
    .from(loyaltyNotification)
    .groupBy(loyaltyNotification.template)
}
