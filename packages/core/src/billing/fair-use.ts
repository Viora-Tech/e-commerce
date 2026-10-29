/** SOURCE OF TRUTH: fair-use visits — WHAT notices a store over its plan's visits two months
 * running / WHY the owner's rule of 2026-10-28: an admin notice, an email and a person from
 * Koomerce reaching out. Nothing is ever blocked, slowed or billed by this.
 */
import { siteConfig } from '@commerce/config/site'
import { dayKey } from '@commerce/dates'
import { type Db, marketingSession, type StoreTx, storePlan, withStore } from '@commerce/db'
import { and, count, eq, gte, lt, sql } from 'drizzle-orm'
import { planName, sendPlanBillEmail } from './emails'
import { PLANS, type PlanId } from './plans'
import { billingMonth, monthRange, previousMonth } from './usage-fee-service'

/**
 * Storefront visits (sessions) started in an IST month. Sessions only count shoppers who
 * accepted analytics, and bots start none, so this undercounts: fine for a soft limit.
 */
async function monthVisits(tx: StoreTx, month: string): Promise<number> {
  const { start, end } = monthRange(month)
  const [row] = await tx
    .select({ n: count() })
    .from(marketingSession)
    .where(and(gte(marketingSession.startedAt, start), lt(marketingSession.startedAt, end)))
  return row?.n ?? 0
}

/** Days at the start of a month the check runs on. */
const FAIR_USE_CHECK_DAYS = 3

/** Over fair use: both of the last two months above the plan's visits. Scale is judged by hand. */
export function overFairUse(plan: PlanId, lastTwo: [number, number]): boolean {
  const limit = PLANS[plan].visitsPerMonth
  return limit !== null && lastTwo[0] > limit && lastTwo[1] > limit
}

/**
 * Checks every store with paid time in the last two finished months against its current plan.
 * A store over both gets `fairUseNoticeMonth` set and one email (copied to support), once per
 * month it closes over. Its status and limits never change.
 */
export async function runFairUseCheck(
  db: Db,
  now = new Date(),
): Promise<{ checked: number; noticed: number }> {
  // Only finished months are judged, so the hourly sweep counts on the first few days of a
  // month (a missed day is caught by the next) and skips the scan the rest of the month.
  if (Number(dayKey(now).slice(8, 10)) > FAIR_USE_CHECK_DAYS) return { checked: 0, noticed: 0 }
  const last = previousMonth(billingMonth(now))
  const before = previousMonth(last)
  const from = monthRange(before).start
  const to = monthRange(last).end
  const ids = await db.execute<{ id: string }>(
    sql`select stores_with_paid_period(${from.toISOString()}::timestamptz, ${to.toISOString()}::timestamptz) as id`,
  )
  const result = { checked: 0, noticed: 0 }
  for (const { id: storeId } of ids) {
    result.checked++
    const noticed = await withStore(db, storeId, async (tx) => {
      const [plan] = await tx.select().from(storePlan).where(eq(storePlan.storeId, storeId))
      if (!plan || plan.unlimited || plan.fairUseNoticeMonth === last) return null
      const visits: [number, number] = [await monthVisits(tx, before), await monthVisits(tx, last)]
      if (!overFairUse(plan.plan, visits)) return null
      await tx
        .update(storePlan)
        .set({ fairUseNoticeMonth: last, updatedAt: now })
        .where(eq(storePlan.storeId, storeId))
      return { plan: plan.plan, visits }
    })
    if (!noticed) continue
    result.noticed++
    await sendPlanBillEmail(db, storeId, {
      kind: 'fair_use',
      what: `${planName(noticed.plan)} plan (${PLANS[noticed.plan].visitsPerMonth?.toLocaleString('en-IN')} visits a month)`,
      amountPaise: 0,
      due: now,
      url: `${siteConfig.urls.admin}/settings/billing`,
      copyTo: siteConfig.contact.supportEmail,
    })
  }
  return result
}
