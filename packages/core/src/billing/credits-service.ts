/**
 * AI credit top-ups: ₹199 for 1,000 credits, bought as an order on the sales store like a plan
 * bill. Paying adds them to the store's bought credits (`ai_settings.extra_credit_millis`), which
 * the AI guard uses after the month's allowance and never resets.
 */
import { aiCreditTopup, aiSettings, type Db, withStore } from '@commerce/db'
import { and, desc, eq, sql } from 'drizzle-orm'
import { orderViewToken, thankYouPath } from '../preorder/balance-link'
import { AI_CREDIT_PACK } from './apps'
import { type BillingEnv, placeSalesOrder } from './service'

export type AiTopupBill = {
  id: string
  credits: number
  number: number
  amountPaise: number
  status: 'due' | 'paid' | 'cancelled'
  paidAt: Date | null
  url: string | null
}

type TopupRow = typeof aiCreditTopup.$inferSelect

const toTopup = (env: BillingEnv, r: TopupRow): AiTopupBill => ({
  id: r.id,
  credits: r.credits,
  number: r.salesOrderNumber,
  amountPaise: r.amountPaise,
  status: r.status,
  paidAt: r.paidAt,
  url: env.salesStorefrontUrl
    ? `${env.salesStorefrontUrl.replace(/\/$/, '')}${thankYouPath(
        r.salesOrderNumber,
        orderViewToken(r.salesOrderId, env.settingsSecret),
      )}`
    : null,
})

/** "Buy 1,000 credits": the pay link; an earlier unpaid top-up is dropped. */
export async function buyAiCredits(
  db: Db,
  storeId: string,
  env: BillingEnv,
): Promise<AiTopupBill> {
  const sale = await placeSalesOrder(db, env, storeId, {
    sku: AI_CREDIT_PACK.sku,
    note: (buyer) => `Koomerce AI credits (${AI_CREDIT_PACK.credits}) for ${buyer}, store ${storeId}`,
  })
  return withStore(db, storeId, async (tx) => {
    await tx
      .update(aiCreditTopup)
      .set({ status: 'cancelled' })
      .where(and(eq(aiCreditTopup.storeId, storeId), eq(aiCreditTopup.status, 'due')))
    const [row] = await tx
      .insert(aiCreditTopup)
      .values({
        storeId,
        credits: AI_CREDIT_PACK.credits,
        salesOrderId: sale.id,
        salesOrderNumber: sale.number,
        amountPaise: sale.totalPaise,
      })
      .returning()
    if (!row) throw new Error('top-up insert returned nothing')
    return toTopup(env, row)
  })
}

/** The sales store's `order.paid` hook for a top-up: the credits are added once. */
export async function markAiTopupPaid(
  db: Db,
  salesOrderId: string,
  now = new Date(),
): Promise<{ storeId: string; credits: number } | null> {
  const rows = await db.execute<{ id: string | null }>(
    sql`select ai_credit_topup_store(${salesOrderId}::uuid) as id`,
  )
  const storeId = rows[0]?.id
  if (!storeId) return null
  return withStore(db, storeId, async (tx) => {
    const [row] = await tx
      .update(aiCreditTopup)
      .set({ status: 'paid', paidAt: now })
      .where(and(eq(aiCreditTopup.salesOrderId, salesOrderId), eq(aiCreditTopup.status, 'due')))
      .returning()
    if (!row) return null
    const millis = row.credits * 1000
    await tx
      .insert(aiSettings)
      .values({ storeId, extraCreditMillis: millis })
      .onConflictDoUpdate({
        target: aiSettings.storeId,
        set: { extraCreditMillis: sql`${aiSettings.extraCreditMillis} + ${millis}` },
      })
    return { storeId, credits: row.credits }
  })
}

/** The sales store cancelled or refunded an unpaid top-up order. */
export async function cancelAiTopup(db: Db, salesOrderId: string): Promise<void> {
  const rows = await db.execute<{ id: string | null }>(
    sql`select ai_credit_topup_store(${salesOrderId}::uuid) as id`,
  )
  const storeId = rows[0]?.id
  if (!storeId) return
  await withStore(db, storeId, (tx) =>
    tx
      .update(aiCreditTopup)
      .set({ status: 'cancelled' })
      .where(and(eq(aiCreditTopup.salesOrderId, salesOrderId), eq(aiCreditTopup.status, 'due'))),
  )
}

/** The store's top-ups, newest first. */
export async function listAiTopups(
  db: Db,
  storeId: string,
  env: BillingEnv,
): Promise<AiTopupBill[]> {
  const rows = await withStore(db, storeId, (tx) =>
    tx
      .select()
      .from(aiCreditTopup)
      .where(eq(aiCreditTopup.storeId, storeId))
      .orderBy(desc(aiCreditTopup.createdAt))
      .limit(24),
  )
  return rows.map((r) => toTopup(env, r))
}
