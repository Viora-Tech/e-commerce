/** SOURCE OF TRUTH: per-order fee inputs — WHAT a month's countable orders and paid plan periods
 * for one store, and this month's running estimate / WHY the monthly usage bill and the Plan &
 * billing page read the same rows. Which orders count: spec 2026-10-28 "The per-order fee".
 */
import { dayKey, dayStart, formatInZone, startOfMonth } from '@commerce/dates'
import { order, planPayment, type StoreTx, usageBill } from '@commerce/db'
import { and, desc, eq, gt, gte, lt, ne } from 'drizzle-orm'
import { csvCell } from '../privacy/export'
import { planName } from './emails'
import { type FeeOrder, feeOrderRows, type MonthFee, monthFee, type PaidPeriod } from './usage-fee'

/** The IST calendar month `at` falls in, `YYYY-MM`. */
export const billingMonth = (at: Date): string => dayKey(at).slice(0, 7)

/** The month before `month` (`2026-01` → `2025-12`). */
export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

/** `[start, end)` of an IST month. */
export function monthRange(month: string): { start: Date; end: Date } {
  const start = dayStart(`${month}-01`)
  return { start, end: startOfMonth(start, undefined, 1) }
}

/**
 * The month's orders that can carry a fee: placed, not cancelled, not test-mode, not refunded
 * in full (judged now, when the bill is made). COD and part refunds count, whole. Plus the paid
 * plan periods overlapping the month, which decide each order's plan.
 */
export async function loadMonthFeeInputs(
  tx: StoreTx,
  storeId: string,
  month: string,
): Promise<{ orders: FeeOrder[]; periods: PaidPeriod[] }> {
  const { start, end } = monthRange(month)
  const [orders, periods] = await Promise.all([
    tx
      .select({
        id: order.id,
        number: order.number,
        placedAt: order.placedAt,
        totalPaise: order.totalPaise,
      })
      .from(order)
      .where(
        and(
          eq(order.storeId, storeId),
          ne(order.status, 'draft'),
          ne(order.status, 'cancelled'),
          eq(order.isTest, false),
          ne(order.paymentStatus, 'refunded'),
          gte(order.placedAt, start),
          lt(order.placedAt, end),
        ),
      ),
    tx
      .select({
        plan: planPayment.plan,
        start: planPayment.periodStart,
        end: planPayment.periodEnd,
      })
      .from(planPayment)
      .where(
        and(
          eq(planPayment.storeId, storeId),
          eq(planPayment.status, 'paid'),
          lt(planPayment.periodStart, end),
          gt(planPayment.periodEnd, start),
        ),
      ),
  ])
  return { orders, periods }
}

/** Fees waiting from earlier months: the store's carried row, if any. */
export async function carriedInPaise(tx: StoreTx, storeId: string): Promise<number> {
  const [row] = await tx
    .select({ totalPaise: usageBill.totalPaise })
    .from(usageBill)
    .where(and(eq(usageBill.storeId, storeId), eq(usageBill.status, 'carried')))
    .orderBy(desc(usageBill.month))
    .limit(1)
  return row?.totalPaise ?? 0
}

/** This month so far, for Plan & billing: the fee the 1st's bill would charge if it ran now. */
export async function feeEstimate(
  tx: StoreTx,
  storeId: string,
  now = new Date(),
): Promise<MonthFee & { carriedInPaise: number; month: string }> {
  const month = billingMonth(now)
  const [{ orders, periods }, carried] = await Promise.all([
    loadMonthFeeInputs(tx, storeId, month),
    carriedInPaise(tx, storeId),
  ])
  return { ...monthFee(orders, periods), carriedInPaise: carried, month }
}

const rupees = (paise: number) => (paise / 100).toFixed(2)

/**
 * "Download CSV" on a usage bill: each order of that month that carried a fee, worked out from
 * the orders as they are now (a later full refund drops out here too). Null when the bill is
 * not this store's.
 */
export async function usageBillCsv(
  tx: StoreTx,
  storeId: string,
  billId: string,
): Promise<{ filename: string; csv: string } | null> {
  const [bill] = await tx
    .select({ month: usageBill.month })
    .from(usageBill)
    .where(and(eq(usageBill.storeId, storeId), eq(usageBill.id, billId)))
  if (!bill) return null
  const { orders, periods } = await loadMonthFeeInputs(tx, storeId, bill.month)
  const rows = feeOrderRows(orders, periods).map((r) =>
    [
      `#${r.number ?? ''}`,
      formatInZone(r.placedAt, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      rupees(r.totalPaise),
      planName(r.plan),
      rupees(r.feePaise),
    ]
      .map(csvCell)
      .join(','),
  )
  return {
    filename: `per-order-fees-${bill.month}.csv`,
    csv: `${['Order,Placed at,Order total (₹),Plan,Fee (₹)', ...rows].join('\n')}\n`,
  }
}
