import type { StoreTx } from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
import type { Channel } from './schema'
import { backInStockUsage } from './schema'
import type { PlatformQuota } from './settings'

/** UTC calendar month, e.g. `2026-09`. Sends reset on the 1st, platform time. */
export function currentPeriod(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function usageThisMonth(
  tx: StoreTx,
  storeId: string,
  channel: Channel,
  now: Date = new Date(),
): Promise<number> {
  const [row] = await tx
    .select({ sent: backInStockUsage.sent })
    .from(backInStockUsage)
    .where(
      and(
        eq(backInStockUsage.storeId, storeId),
        eq(backInStockUsage.period, currentPeriod(now)),
        eq(backInStockUsage.channel, channel),
      ),
    )
  return row?.sent ?? 0
}

/** The free quota for a channel, from platform config. */
export function freeQuotaFor(quota: PlatformQuota, channel: Channel): number {
  return channel === 'email' ? quota.freeEmailPerMonth : quota.freeWhatsappPerMonth
}

/**
 * Whether one more message on `channel` fits this month. `unlimited` (the
 * store's override) always allows it; otherwise the running count this month
 * must stay under the platform's free quota. Above quota, callers must pause
 * rather than send — there is no pay-as-you-go path yet.
 */
export async function hasQuotaRemaining(
  tx: StoreTx,
  storeId: string,
  channel: Channel,
  quota: PlatformQuota,
  unlimited: boolean,
  now: Date = new Date(),
): Promise<boolean> {
  if (unlimited) return true
  const used = await usageThisMonth(tx, storeId, channel, now)
  return used < freeQuotaFor(quota, channel)
}

/**
 * Record one sent message. `on conflict do update` makes concurrent batches
 * (two workers, or a retried batch) additive and race-free: each call adds
 * exactly one to the count for the store's current month and channel.
 */
export async function recordSent(
  tx: StoreTx,
  storeId: string,
  channel: Channel,
  now: Date = new Date(),
): Promise<void> {
  const period = currentPeriod(now)
  await tx
    .insert(backInStockUsage)
    .values({ storeId, period, channel, sent: 1, updatedAt: now })
    .onConflictDoUpdate({
      target: [backInStockUsage.storeId, backInStockUsage.period, backInStockUsage.channel],
      set: { sent: sql`${backInStockUsage.sent} + 1`, updatedAt: now },
    })
}

export type UsageOverview = {
  period: string
  email: { sent: number; quota: number; unlimited: boolean }
  whatsapp: { sent: number; quota: number; unlimited: boolean }
}

export async function usageOverview(
  tx: StoreTx,
  storeId: string,
  quota: PlatformQuota,
  unlimited: boolean,
  now: Date = new Date(),
): Promise<UsageOverview> {
  const [email, whatsapp] = await Promise.all([
    usageThisMonth(tx, storeId, 'email', now),
    usageThisMonth(tx, storeId, 'whatsapp', now),
  ])
  return {
    period: currentPeriod(now),
    email: { sent: email, quota: quota.freeEmailPerMonth, unlimited },
    whatsapp: { sent: whatsapp, quota: quota.freeWhatsappPerMonth, unlimited },
  }
}
