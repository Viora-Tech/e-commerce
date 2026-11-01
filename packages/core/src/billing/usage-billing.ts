/** SOURCE OF TRUTH: runUsageBilling, runUsageReminders, markUsageBillPaid, cancelUsageBill
 * WHAT:  Per-order fee bills: the 1st's bill for the month that ended, its reminder emails, and
 *        the sales store's paid / cancelled hooks for it.
 * WHY:   Split from service.ts (#973), which keeps plan bills and the sweep and re-exports these;
 *        a fee bill still becomes a sales-store order through `placeSalesOrder`.
 */

import { siteConfig } from '@commerce/config/site'
import { formatInZone } from '@commerce/dates'
import { type Db, usageBill, withStore } from '@commerce/db'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { sendPlanBillEmail } from './emails'
import { GRACE_DAYS, PLAN_GST_PERCENT } from './plans'
import {
  type BillingEnv,
  BillingNotReady,
  placeSalesOrder,
  salesOrderUrl,
  usageFeeSku,
} from './service'
import { billable, monthFee } from './usage-fee'
import { billingMonth, loadMonthFeeInputs, monthRange, previousMonth } from './usage-fee-service'

const DAY_MS = 86_400_000

/** "October 2026" for the bill and its email. */
const monthLabel = (month: string): string =>
  formatInZone(`${month}-15T00:00:00Z`, { month: 'long', year: 'numeric' }, { timeZone: 'UTC' })

export type UsageBillingResult = { stores: number; billed: number; carried: number }

/**
 * The 1st's per-order fee bill for the month that just ended, for every store that had paid
 * plan time in it. Runs with the hourly sweep and is idempotent: a store and month get one
 * `usage_bill` row, written first as a claim (the unique index lets one sweep win when two
 * overlap), so later runs skip it. Under ₹100 (with what was carried in) the month is recorded
 * as `carried`; otherwise one order on the sales store, a line per plan rate plus one for
 * carried fees, and an email with the pay link. Never changes a store's plan status.
 */
export async function runUsageBilling(
  db: Db,
  env: BillingEnv,
  now = new Date(),
): Promise<UsageBillingResult> {
  const result: UsageBillingResult = { stores: 0, billed: 0, carried: 0 }
  const month = previousMonth(billingMonth(now))
  const { start, end } = monthRange(month)
  const ids = await db.execute<{ id: string }>(
    sql`select stores_with_paid_period(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz) as id`,
  )
  for (const { id: storeId } of ids) {
    result.stores++
    const claim = await withStore(db, storeId, async (tx) => {
      const [done] = await tx
        .select({ id: usageBill.id })
        .from(usageBill)
        .where(and(eq(usageBill.storeId, storeId), eq(usageBill.month, month)))
      if (done) return null
      const carried = await tx
        .select({ id: usageBill.id, totalPaise: usageBill.totalPaise })
        .from(usageBill)
        .where(and(eq(usageBill.storeId, storeId), eq(usageBill.status, 'carried')))
      const { orders, periods } = await loadMonthFeeInputs(tx, storeId, month)
      const fee = monthFee(orders, periods)
      const carriedIn = carried.reduce((n, c) => n + c.totalPaise, 0)
      const { bill, totalPaise } = billable(fee.feePaise, carriedIn)
      const [row] = await tx
        .insert(usageBill)
        .values({
          storeId,
          month,
          ordersCounted: fee.ordersCounted,
          feeOrders: fee.feeOrders,
          feePaise: fee.feePaise,
          carriedInPaise: carriedIn,
          totalPaise,
          lines: fee.lines,
          status: bill ? 'due' : 'carried',
          createdAt: now,
        })
        .onConflictDoNothing({ target: [usageBill.storeId, usageBill.month] })
        .returning({ id: usageBill.id })
      if (!row) return null
      const carriedIds = carried.map((c) => c.id)
      // A carried month folds in now; a billed one once its order exists.
      if (!bill && carriedIds.length > 0)
        await tx
          .update(usageBill)
          .set({ status: 'merged' })
          .where(inArray(usageBill.id, carriedIds))
      return { id: row.id, bill, fee, carriedIn, carriedIds }
    })
    if (!claim) continue
    if (!claim.bill) {
      result.carried++
      continue
    }
    let sale: Awaited<ReturnType<typeof placeSalesOrder>>
    try {
      sale = await placeSalesOrder(db, env, storeId, {
        lines: [
          ...claim.fee.lines.map((l) => ({
            sku: usageFeeSku(l.plan),
            unitPricePaise: l.feePaise,
          })),
          ...(claim.carriedIn > 0
            ? [{ sku: usageFeeSku('carried'), unitPricePaise: claim.carriedIn }]
            : []),
        ],
        note: (buyer) =>
          `${siteConfig.brand.name} per-order fees ${month} for ${buyer}, store ${storeId}`,
      })
    } catch (err) {
      // No order: drop the claim so the next run tries again.
      await withStore(db, storeId, (tx) => tx.delete(usageBill).where(eq(usageBill.id, claim.id)))
      if (err instanceof BillingNotReady) continue
      throw err
    }
    await withStore(db, storeId, async (tx) => {
      await tx
        .update(usageBill)
        .set({ salesOrderId: sale.id, salesOrderNumber: sale.number })
        .where(eq(usageBill.id, claim.id))
      if (claim.carriedIds.length > 0)
        await tx
          .update(usageBill)
          .set({ status: 'merged', mergedIntoSalesOrderId: sale.id })
          .where(inArray(usageBill.id, claim.carriedIds))
    })
    result.billed++
    await sendPlanBillEmail(db, storeId, {
      kind: 'usage',
      what: `Per-order fees for ${monthLabel(month)}`,
      amountPaise: sale.totalPaise,
      due: new Date(now.getTime() + GRACE_DAYS * DAY_MS),
      url: salesOrderUrl(env, sale.id, sale.number),
    })
  }
  return result
}

/** Days after billing that an unpaid fee bill is reminded about, one email each. */
const USAGE_REMINDER_DAYS = [3, 7] as const

/**
 * Reminder emails for fee bills still `due` with a pay link: 3 and 7 days after they were
 * billed. Nothing is paused; an unpaid fee joins the next plan bill.
 */
export async function runUsageReminders(
  db: Db,
  env: BillingEnv,
  now = new Date(),
): Promise<{ reminded: number }> {
  const result = { reminded: 0 }
  const ids = await db.execute<{ id: string }>(sql`select stores_with_due_usage_bills() as id`)
  for (const { id: storeId } of ids) {
    const due = await withStore(db, storeId, async (tx) => {
      const rows = await tx
        .select()
        .from(usageBill)
        .where(and(eq(usageBill.storeId, storeId), eq(usageBill.status, 'due')))
      const out: (typeof rows)[number][] = []
      for (const b of rows) {
        const after = USAGE_REMINDER_DAYS[b.remindersSent]
        if (!b.salesOrderId || after === undefined) continue
        if (now.getTime() - b.createdAt.getTime() < after * DAY_MS) continue
        // The guard on the old count keeps two sweeps from sending the same reminder.
        const [won] = await tx
          .update(usageBill)
          .set({ remindersSent: b.remindersSent + 1 })
          .where(and(eq(usageBill.id, b.id), eq(usageBill.remindersSent, b.remindersSent)))
          .returning({ id: usageBill.id })
        if (won) out.push(b)
      }
      return out
    })
    for (const b of due) {
      if (!b.salesOrderId || b.salesOrderNumber === null) continue
      result.reminded++
      await sendPlanBillEmail(db, storeId, {
        kind: 'usage',
        what: `Per-order fees for ${monthLabel(b.month)}`,
        // The bill's own order added GST on the sales store; the row keeps the amount before it.
        amountPaise: Math.round((b.totalPaise * (100 + PLAN_GST_PERCENT)) / 100),
        due: new Date(b.createdAt.getTime() + GRACE_DAYS * DAY_MS),
        url: salesOrderUrl(env, b.salesOrderId, b.salesOrderNumber),
      })
    }
  }
  return result
}

/** The store a fee bill's sales order belongs to (its own order, or the plan bill it joined). */
async function usageBillStore(db: Db, salesOrderId: string): Promise<string | null> {
  const rows = await db.execute<{ id: string | null }>(
    sql`select usage_bill_store(${salesOrderId}::uuid) as id`,
  )
  return rows[0]?.id ?? null
}

/** The sales store's `order.paid` hook for a fee bill. Safe to run twice. */
export async function markUsageBillPaid(
  db: Db,
  salesOrderId: string,
  now = new Date(),
): Promise<{ storeId: string } | null> {
  const storeId = await usageBillStore(db, salesOrderId)
  if (!storeId) return null
  const updated = await withStore(db, storeId, async (tx) => {
    const paid = await tx
      .update(usageBill)
      .set({ status: 'paid', paidAt: now })
      .where(and(eq(usageBill.salesOrderId, salesOrderId), eq(usageBill.status, 'due')))
      .returning({ id: usageBill.id })
    // Earlier months it carried are paid with it.
    if (paid.length > 0)
      await tx
        .update(usageBill)
        .set({ status: 'paid', paidAt: now })
        .where(
          and(eq(usageBill.mergedIntoSalesOrderId, salesOrderId), eq(usageBill.status, 'merged')),
        )
    return paid
  })
  return updated.length > 0 ? { storeId } : null
}

/**
 * The sales store cancelled or fully refunded a fee bill's order. Only a `due` bill turns
 * `cancelled`: a bill already added to a plan bill (`merged`) stays owed through that one.
 */
export async function cancelUsageBill(db: Db, salesOrderId: string): Promise<void> {
  const storeId = await usageBillStore(db, salesOrderId)
  if (!storeId) return
  await withStore(db, storeId, (tx) =>
    tx
      .update(usageBill)
      .set({ status: 'cancelled' })
      .where(and(eq(usageBill.salesOrderId, salesOrderId), eq(usageBill.status, 'due'))),
  )
}
