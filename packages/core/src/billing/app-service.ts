/**
 * Paid apps: buying an app the store's plan does not include, as a monthly bill on the sales
 * store (the same order, payment and GST-invoice path as plan bills). Paying installs the app;
 * renewals are billed a few days ahead; stopping keeps the app until the paid month ends.
 */
import { appPurchase, type Db, type StoreTx, store, withStore } from '@commerce/db'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { recordAppInstall } from '../apps/installation'
import { installApp, parseAppsSettings } from '../apps/settings'
import { orderViewToken, thankYouPath } from '../preorder/balance-link'
import { APP_PRICING, type AppAccess, appAccess, appSku } from './apps'
import { addInterval, GRACE_DAYS, type PlanId, RENEW_AHEAD_DAYS } from './plans'
import { type BillingEnv, BillingNotReady, ensureStorePlan, placeSalesOrder } from './service'

const DAY_MS = 86_400_000

type PurchaseRow = typeof appPurchase.$inferSelect

export type AppBill = {
  id: string
  pluginId: string
  number: number
  amountPaise: number
  periodStart: Date
  periodEnd: Date
  status: PurchaseRow['status']
  paidAt: Date | null
  url: string | null
}

const toAppBill = (env: BillingEnv, r: PurchaseRow): AppBill => ({
  id: r.id,
  pluginId: r.pluginId,
  number: r.salesOrderNumber,
  amountPaise: r.amountPaise,
  periodStart: r.periodStart,
  periodEnd: r.periodEnd,
  status: r.status,
  paidAt: r.paidAt,
  url: env.salesStorefrontUrl
    ? `${env.salesStorefrontUrl.replace(/\/$/, '')}${thankYouPath(
        r.salesOrderNumber,
        orderViewToken(r.salesOrderId, env.settingsSecret),
      )}`
    : null,
})

/** The plan an app check uses: a trial counts as its plan, like every other limit. */
async function currentPlan(tx: StoreTx, storeId: string, now: Date): Promise<PlanId> {
  return (await ensureStorePlan(tx, storeId, now)).plan
}

/**
 * What each paid app has been bought through: the latest paid month, and whether it renews.
 * A renewal still waiting for payment keeps the app for the grace days after the month.
 */
async function boughtApps(tx: StoreTx, storeId: string) {
  const rows = await tx
    .select()
    .from(appPurchase)
    .where(eq(appPurchase.storeId, storeId))
    .orderBy(desc(appPurchase.periodEnd))
  const out = new Map<string, { until: Date; renews: boolean }>()
  for (const r of rows) {
    if (out.has(r.pluginId) || !r.paidAt) continue
    const renewing = rows.some((x) => x.pluginId === r.pluginId && x.status === 'due' && !x.paidAt)
    const renews = r.status === 'active'
    out.set(r.pluginId, {
      until: renewing ? new Date(r.periodEnd.getTime() + GRACE_DAYS * DAY_MS) : r.periodEnd,
      renews,
    })
  }
  return out
}

/** Every paid app's access for this store (apps not listed in `APP_PRICING` are free). */
export async function storeAppAccess(
  tx: StoreTx,
  storeId: string,
  now = new Date(),
): Promise<Record<string, AppAccess>> {
  const [plan, bought] = await Promise.all([currentPlan(tx, storeId, now), boughtApps(tx, storeId)])
  return Object.fromEntries(
    Object.keys(APP_PRICING).map((id) => [id, appAccess(id, plan, bought.get(id) ?? null, now)]),
  )
}

/** One app's access, for the install guard. */
export async function accessForApp(
  tx: StoreTx,
  storeId: string,
  pluginId: string,
  now = new Date(),
): Promise<AppAccess> {
  if (!APP_PRICING[pluginId]) return { state: 'free' }
  return (await storeAppAccess(tx, storeId, now))[pluginId] as AppAccess
}

export class AppNotForSale extends Error {
  constructor(readonly pluginId: string) {
    super(`${pluginId} does not need buying on this plan`)
  }
}

/** Bills one month of a paid app on the sales store; any older unpaid bill for it goes. */
export async function createAppBill(
  db: Db,
  storeId: string,
  input: { pluginId: string; periodStart: Date },
  env: BillingEnv,
): Promise<AppBill> {
  const sale = await placeSalesOrder(db, env, storeId, {
    sku: appSku(input.pluginId),
    note: (buyer) => `Koomerce app ${input.pluginId} for ${buyer}, store ${storeId}`,
  })
  return withStore(db, storeId, async (tx) => {
    await tx
      .update(appPurchase)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(appPurchase.storeId, storeId),
          eq(appPurchase.pluginId, input.pluginId),
          eq(appPurchase.status, 'due'),
        ),
      )
    const [row] = await tx
      .insert(appPurchase)
      .values({
        storeId,
        pluginId: input.pluginId,
        salesOrderId: sale.id,
        salesOrderNumber: sale.number,
        amountPaise: sale.totalPaise,
        periodStart: input.periodStart,
        periodEnd: addInterval(input.periodStart, 'month'),
        status: 'due',
      })
      .returning()
    if (!row) throw new Error('app bill insert returned nothing')
    return toAppBill(env, row)
  })
}

/** "Buy" in the App Store: the pay link for the first month. */
export async function buyApp(
  db: Db,
  storeId: string,
  pluginId: string,
  env: BillingEnv,
  now = new Date(),
): Promise<AppBill> {
  const access = await withStore(db, storeId, (tx) => accessForApp(tx, storeId, pluginId, now))
  if (access.state !== 'buy') throw new AppNotForSale(pluginId)
  return createAppBill(db, storeId, { pluginId, periodStart: now }, env)
}

/**
 * The sales store's `order.paid` hook for an app bill: the month starts (when the money arrived,
 * if late) and the app is installed. Safe to run twice.
 */
export async function markAppBillPaid(
  db: Db,
  salesOrderId: string,
  now = new Date(),
): Promise<{ storeId: string; pluginId: string } | null> {
  const rows = await db.execute<{ id: string | null }>(
    sql`select app_purchase_store(${salesOrderId}::uuid) as id`,
  )
  const storeId = rows[0]?.id
  if (!storeId) return null
  return withStore(db, storeId, async (tx) => {
    const [bill] = await tx
      .select()
      .from(appPurchase)
      .where(eq(appPurchase.salesOrderId, salesOrderId))
    if (!bill) return null
    if (bill.paidAt) return { storeId, pluginId: bill.pluginId }
    const start = bill.periodStart > now ? bill.periodStart : now
    await tx
      .update(appPurchase)
      .set({
        status: 'active',
        paidAt: now,
        periodStart: start,
        periodEnd: addInterval(start, 'month'),
      })
      .where(eq(appPurchase.id, bill.id))
    // The months before it no longer renew on their own: this one does.
    await tx
      .update(appPurchase)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(appPurchase.storeId, storeId),
          eq(appPurchase.pluginId, bill.pluginId),
          eq(appPurchase.status, 'active'),
          sql`${appPurchase.id} <> ${bill.id}`,
        ),
      )
    const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
    await tx
      .update(store)
      .set({ apps: installApp(parseAppsSettings(s?.apps), bill.pluginId) })
      .where(eq(store.id, storeId))
    await recordAppInstall(tx, storeId, bill.pluginId, null, now)
    return { storeId, pluginId: bill.pluginId }
  })
}

/** The sales store cancelled or refunded an app order before it was paid for good. */
export async function cancelAppBill(db: Db, salesOrderId: string): Promise<void> {
  const rows = await db.execute<{ id: string | null }>(
    sql`select app_purchase_store(${salesOrderId}::uuid) as id`,
  )
  const storeId = rows[0]?.id
  if (!storeId) return
  await withStore(db, storeId, (tx) =>
    tx
      .update(appPurchase)
      .set({ status: 'cancelled' })
      .where(and(eq(appPurchase.salesOrderId, salesOrderId), eq(appPurchase.status, 'due'))),
  )
}

/** "Stop renewing": the app works until the paid month ends; unpaid bills are dropped. */
export async function stopAppRenewal(tx: StoreTx, storeId: string, pluginId: string) {
  await tx
    .update(appPurchase)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(appPurchase.storeId, storeId),
        eq(appPurchase.pluginId, pluginId),
        inArray(appPurchase.status, ['active', 'due']),
      ),
    )
}

/** The store's app bills, newest first, for Plan & billing. */
export async function listAppBills(
  tx: StoreTx,
  storeId: string,
  env: BillingEnv,
): Promise<AppBill[]> {
  const rows = await tx
    .select()
    .from(appPurchase)
    .where(eq(appPurchase.storeId, storeId))
    .orderBy(desc(appPurchase.createdAt))
    .limit(48)
  return rows.map((r) => toAppBill(env, r))
}

export type AppRenewalResult = { stores: number; billed: number; lapsed: number }

/**
 * Part of the hourly billing sweep: a bought app whose month ends within 3 days is billed for
 * the next month; an unpaid renewal past the grace days is dropped (the app then needs buying).
 */
export async function runAppRenewals(
  db: Db,
  env: BillingEnv,
  now = new Date(),
): Promise<AppRenewalResult> {
  const result: AppRenewalResult = { stores: 0, billed: 0, lapsed: 0 }
  const ids = await db.execute<{ id: string }>(
    sql`select stores_with_app_renewals(${now.toISOString()}::timestamptz) as id`,
  )
  for (const { id: storeId } of ids) {
    result.stores++
    const rows = await withStore(db, storeId, (tx) =>
      tx
        .select()
        .from(appPurchase)
        .where(eq(appPurchase.storeId, storeId))
        .orderBy(desc(appPurchase.periodEnd)),
    )
    for (const pluginId of new Set(rows.map((r) => r.pluginId))) {
      const mine = rows.filter((r) => r.pluginId === pluginId)
      const due = mine.find((r) => r.status === 'due')
      const active = mine.find((r) => r.status === 'active' && r.paidAt)
      if (due && due.periodStart.getTime() + GRACE_DAYS * DAY_MS < now.getTime()) {
        await withStore(db, storeId, (tx) =>
          tx.update(appPurchase).set({ status: 'cancelled' }).where(eq(appPurchase.id, due.id)),
        )
        result.lapsed++
        continue
      }
      if (
        !due &&
        active &&
        active.periodEnd.getTime() - now.getTime() <= RENEW_AHEAD_DAYS * DAY_MS
      ) {
        try {
          await createAppBill(db, storeId, { pluginId, periodStart: active.periodEnd }, env)
          result.billed++
        } catch (err) {
          if (!(err instanceof BillingNotReady)) throw err
        }
      }
    }
  }
  return result
}
