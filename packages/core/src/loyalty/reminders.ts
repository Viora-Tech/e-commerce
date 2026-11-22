/** SOURCE OF TRUTH: points expiry reminders — WHAT: which customers have points running out within the store's reminder window and were not told yet, with what to say, and marking them told / WHY: one email per credited entry, never a second, and never for points already spent */
import { customer, loyaltyEntry } from '@commerce/db'
import { and, eq, gt, inArray, isNotNull, isNull, lte } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { pointsSummary } from './ledger'
import type { LoyaltySettings } from './settings'

const DAY_MS = 86_400_000

/** At most this many customers per store per sweep. */
const REMINDER_BATCH = 100

export type PointsReminder = {
  customerId: string
  email: string
  name: string | null
  /** Points the customer holds now. */
  points: number
  /** The soonest points to run out and their last day (`YYYY-MM-DD`, store time). */
  expiringPoints: number
  lastDay: string
  /** The credited entries this reminder covers, marked once it is sent. */
  entryIds: string[]
}

/**
 * Customers with credited points running out within `reminderDays` that were never reminded
 * about, and an email to send to. A customer whose points were all spent is marked reminded
 * without a message (nothing to say). Off when `reminderDays` is 0.
 */
export async function duePointsReminders(
  ctx: StoreContext,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<PointsReminder[]> {
  if (settings.reminderDays <= 0) return []
  const by = new Date(now.getTime() + settings.reminderDays * DAY_MS)
  const rows = await ctx.tx
    .select({
      id: loyaltyEntry.id,
      customerId: loyaltyEntry.customerId,
      email: customer.email,
      name: customer.name,
    })
    .from(loyaltyEntry)
    .innerJoin(customer, eq(customer.id, loyaltyEntry.customerId))
    .where(
      and(
        eq(loyaltyEntry.status, 'credited'),
        gt(loyaltyEntry.points, 0),
        isNotNull(loyaltyEntry.expiresAt),
        gt(loyaltyEntry.expiresAt, now),
        lte(loyaltyEntry.expiresAt, by),
        isNull(loyaltyEntry.remindedAt),
      ),
    )
    .limit(REMINDER_BATCH * 5)
  const byCustomer = new Map<string, { email: string | null; name: string | null; ids: string[] }>()
  for (const r of rows) {
    const c = byCustomer.get(r.customerId) ?? { email: r.email, name: r.name, ids: [] }
    c.ids.push(r.id)
    byCustomer.set(r.customerId, c)
  }
  const out: PointsReminder[] = []
  for (const [customerId, c] of [...byCustomer].slice(0, REMINDER_BATCH)) {
    const summary = await pointsSummary(ctx, customerId, settings.reminderDays, now)
    if (!c.email || !summary.expiringSoon) {
      await markPointsReminded(ctx, c.ids, now)
      continue
    }
    out.push({
      customerId,
      email: c.email,
      name: c.name,
      points: summary.points,
      expiringPoints: summary.expiringSoon.points,
      lastDay: summary.expiringSoon.lastDay,
      entryIds: c.ids,
    })
  }
  return out
}

/** Marks the entries reminded, so the sweep never emails about them again. */
export async function markPointsReminded(
  ctx: StoreContext,
  entryIds: string[],
  now: Date = new Date(),
): Promise<void> {
  if (entryIds.length === 0) return
  await ctx.tx
    .update(loyaltyEntry)
    .set({ remindedAt: now })
    .where(and(inArray(loyaltyEntry.id, entryIds), isNull(loyaltyEntry.remindedAt)))
}
