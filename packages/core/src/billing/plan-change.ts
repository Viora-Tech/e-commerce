/** SOURCE OF TRUTH: plan changes — WHAT "Move to Pro?" quotes and what choosing a plan bills or
 * schedules / WHY the quote the owner sees and the bill `choosePlan` places come from one call to
 * `quotePlanChange`, so Pay now is the sales order's total.
 */
import type { Db, StoreTx } from '@commerce/db'
import { storePlan, usageBill, withStore } from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
import { CommerceError } from '../errors'
import { planName } from './emails'
import type { BillingInterval, PlanId } from './plans'
import { type PlanChangeQuote, type PlanChargeQuote, quotePlanChange } from './proration'
import {
  type BillingEnv,
  createPlanBill,
  ensureStorePlan,
  type PlanBill,
  UnlimitedPlan,
} from './service'

/** Already on that plan and interval, with paid time left: there is nothing to bill. */
export class AlreadyOnPlan extends CommerceError {
  constructor() {
    super('ALREADY_ON_PLAN', 'This store is already on that plan.')
  }
}

/** A rupee amount for the sales order's note: `3333.00`. */
const rupees = (paise: number) => (paise / 100).toFixed(2)

/** The order note's breakdown, so the sales store's staff can see how the amount was reached. */
export function quoteNote(q: PlanChargeQuote, start: Date, end: Date): string {
  const span = `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`
  return [
    `${planName(q.plan)} ${span} ₹${rupees(q.newPlanPaise)}`,
    q.creditPlan ? `less ${planName(q.creditPlan)} days not used ₹${rupees(q.creditPaise)}` : null,
    `GST ₹${rupees(q.gstPaise)}`,
  ]
    .filter(Boolean)
    .join(', ')
}

/** Per-order fee bills still owed: the next plan bill adds them as a line (`createPlanBill`). */
async function dueFeesPaise(tx: StoreTx, storeId: string): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`coalesce(sum(${usageBill.totalPaise}), 0)::int` })
    .from(usageBill)
    .where(and(eq(usageBill.storeId, storeId), eq(usageBill.status, 'due')))
  return row?.n ?? 0
}

/**
 * "Move to Pro?": what choosing `input` costs now, or that it waits for the period end. The same
 * quote `choosePlan` bills, so the dialog's Pay now is the sales order's total.
 */
export async function loadPlanChangeQuote(
  db: Db,
  storeId: string,
  input: { plan: PlanId; interval: BillingInterval },
  now = new Date(),
): Promise<PlanChangeQuote> {
  const { row, fees } = await withStore(db, storeId, async (tx) => ({
    row: await ensureStorePlan(tx, storeId, now),
    fees: await dueFeesPaise(tx, storeId),
  }))
  if (row.unlimited) throw new UnlimitedPlan()
  return quotePlanChange(row, input, now, fees)
}

/**
 * The owner picked a plan (`quotePlanChange` decides how). An upgrade on a paid plan is billed
 * now for the rest of the period less the old plan's unused days; any plan while trialing, due
 * or paused is billed at full price for one interval from now; either starts when paid. A
 * downgrade on an active plan waits for the period to end, with no refund. Choosing the plan
 * the store is already on, with paid time left, is refused (`AlreadyOnPlan`).
 */
export async function choosePlan(
  db: Db,
  storeId: string,
  input: { plan: PlanId; interval: BillingInterval },
  env: BillingEnv,
  now = new Date(),
): Promise<{ bill: PlanBill | null; scheduled: boolean }> {
  const quote = await loadPlanChangeQuote(db, storeId, input, now)
  if (quote.kind === 'same') throw new AlreadyOnPlan()
  if (quote.kind === 'scheduled') {
    await withStore(db, storeId, (tx) =>
      tx
        .update(storePlan)
        .set({ nextPlan: input.plan, updatedAt: now })
        .where(eq(storePlan.storeId, storeId)),
    )
    return { bill: null, scheduled: true }
  }
  const bill = await createPlanBill(
    db,
    storeId,
    { ...input, periodStart: quote.periodStart, quote },
    env,
  )
  return { bill, scheduled: false }
}
