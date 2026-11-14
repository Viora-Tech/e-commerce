/** SOURCE OF TRUTH: plan usage — WHAT: orders, staff, media and AI a store used this month / WHY: compared against the plan limits */
import { dayKey, startOfMonth } from '@commerce/dates'
import { aiUsage, media, order, type StoreTx, storeMember } from '@commerce/db'
import { and, eq, gte, ne, sql } from 'drizzle-orm'

/** What a store used this calendar month (IST), against its plan's limits. */
export type PlanUsage = {
  orders: number
  /** What this month's orders took, in paise: the average order for the pace maths. */
  salesPaise: number
  staff: number
  storageBytes: number
  ai: { calls: number; tokens: number; credits: number }
}

/** This month's orders and what they took; drafts, cancelled and test-mode orders left out. */
function monthOrders(tx: StoreTx, monthStart: Date) {
  return tx
    .select({
      n: sql<number>`count(*)::int`,
      sales: sql<number>`coalesce(sum(${order.totalPaise}), 0)::bigint`,
    })
    .from(order)
    .where(
      and(
        ne(order.status, 'draft'),
        ne(order.status, 'cancelled'),
        // Test-mode orders (gateway test keys) do not use up the plan's order allowance.
        eq(order.isTest, false),
        gte(order.placedAt, monthStart),
      ),
    )
}

/** Orders placed this month alone: the admin sidebar's usage card needs nothing else. */
export async function planOrdersUsed(tx: StoreTx, now = new Date()): Promise<number> {
  const [row] = await monthOrders(tx, startOfMonth(now))
  return row?.n ?? 0
}

/** Orders placed this month, active staff, stored file bytes and this month's AI use. */
export async function planUsage(tx: StoreTx, now = new Date()): Promise<PlanUsage> {
  const monthStart = startOfMonth(now)
  // The AI usage bucket is the IST month, `YYYY-MM` (packages/ai aiMonth).
  const month = dayKey(now).slice(0, 7)
  const [[orders], [staff], [storage], [ai]] = await Promise.all([
    monthOrders(tx, monthStart),
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(storeMember)
      .where(eq(storeMember.status, 'active')),
    tx.select({ bytes: sql<number>`coalesce(sum(${media.size}), 0)::bigint` }).from(media),
    tx
      .select({
        calls: sql<number>`coalesce(sum(${aiUsage.calls}), 0)::int`,
        tokens: sql<number>`coalesce(sum(${aiUsage.inputTokens} + ${aiUsage.outputTokens}), 0)::bigint`,
        creditMillis: sql<number>`coalesce(sum(${aiUsage.creditMillis}), 0)::bigint`,
      })
      .from(aiUsage)
      .where(eq(aiUsage.month, month)),
  ])
  return {
    orders: orders?.n ?? 0,
    salesPaise: Number(orders?.sales ?? 0),
    staff: staff?.n ?? 0,
    storageBytes: Number(storage?.bytes ?? 0),
    ai: {
      calls: ai?.calls ?? 0,
      tokens: Number(ai?.tokens ?? 0),
      credits: Number(ai?.creditMillis ?? 0) / 1000,
    },
  }
}
