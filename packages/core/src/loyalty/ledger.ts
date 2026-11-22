/** SOURCE OF TRUTH: a customer's loyalty points — WHAT: the points balance (what is left of the `loyalty` store credit lines, oldest spent first), points expiring soon and on the way, the history for staff and for the shopper, and staff adding or removing points with a reason / WHY: points are store credit, so the balance is read from the store credit ledger replay (`openLots`) rather than kept twice */
import { customer, loyaltyEntry, order, storeCreditEntry } from '@commerce/db'
import { and, asc, desc, eq, gt, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { changeStoreCredit, StoreCreditError } from '../customers/store-credit'
import {
  lockStoreCreditBalance,
  openLots,
  spendableStoreCredit,
  storeCreditLastDay,
  storeCreditTimeZone,
} from '../customers/store-credit-expiry'
import { creditPoints } from './earn'
import { type LoyaltySettings, POINT_PAISE } from './settings'

type Source = (typeof loyaltyEntry.$inferSelect)['source']
type Status = (typeof loyaltyEntry.$inferSelect)['status']

/** What a points balance looks like on either side (admin and storefront). */
export type PointsSummary = {
  /** Points the customer can spend now (₹1 each). */
  points: number
  /** The soonest points to run out within `soonDays`, and their last day (`YYYY-MM-DD`). */
  expiringSoon: { points: number; lastDay: string } | null
  /** Points earned but waiting for an order's return window. */
  pendingPoints: number
}

const DAY_MS = 86_400_000

/**
 * What is left of the customer's `loyalty` store credit lines, oldest spent first: per line id,
 * the paise still held and when it runs out. Lines that never expire are summed apart.
 */
async function loyaltyLots(ctx: StoreContext, customerId: string, now: Date) {
  const ledger = await ctx.tx
    .select({
      id: storeCreditEntry.id,
      amountPaise: storeCreditEntry.amountPaise,
      kind: storeCreditEntry.kind,
      expiresAt: storeCreditEntry.expiresAt,
      expiredEntryId: storeCreditEntry.expiredEntryId,
    })
    .from(storeCreditEntry)
    .where(eq(storeCreditEntry.customerId, customerId))
    .orderBy(asc(storeCreditEntry.id))
  const loyaltyIds = new Set(
    ledger.filter((l) => l.kind === 'loyalty' && l.amountPaise > 0).map((l) => l.id),
  )
  const lots = openLots(ledger).filter(
    (l) => loyaltyIds.has(l.entryId) && l.expiresAt.getTime() > now.getTime(),
  )
  const neverPaise = ledger
    .filter((l) => l.kind === 'loyalty' && l.amountPaise > 0 && !l.expiresAt)
    .reduce((sum, l) => sum + l.amountPaise, 0)
  return { lots, neverPaise }
}

/**
 * The customer's points: what is left of their points (never more than the whole store credit
 * balance), the soonest to expire within `soonDays`, and points on the way. Points that never
 * expire (expiry set to 0) are counted at what was given, capped by the balance.
 */
export async function pointsSummary(
  ctx: StoreContext,
  customerId: string,
  soonDays = 30,
  now: Date = new Date(),
): Promise<PointsSummary> {
  const { lots, neverPaise } = await loyaltyLots(ctx, customerId, now)
  const spendable = await spendableStoreCredit(ctx, customerId, now)
  const lotPaise = lots.reduce((sum, l) => sum + l.remainingPaise, 0)
  const points = Math.floor(Math.min(spendable, lotPaise + neverPaise) / POINT_PAISE)
  const soonBy = now.getTime() + soonDays * DAY_MS
  const soon = lots
    .filter((l) => l.expiresAt.getTime() <= soonBy)
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
  const first = soon[0]
  const timeZone = await storeCreditTimeZone(ctx)
  const expiringSoon =
    first && points > 0
      ? {
          points: Math.min(
            points,
            Math.floor(
              soon
                .filter((l) => l.expiresAt.getTime() === first.expiresAt.getTime())
                .reduce((sum, l) => sum + l.remainingPaise, 0) / POINT_PAISE,
            ),
          ),
          lastDay: storeCreditLastDay(first.expiresAt, timeZone),
        }
      : null
  const [pending] = await ctx.tx
    .select({ points: sql<number>`coalesce(sum(${loyaltyEntry.points}), 0)::int` })
    .from(loyaltyEntry)
    .where(and(eq(loyaltyEntry.customerId, customerId), eq(loyaltyEntry.status, 'pending')))
  return {
    points,
    expiringSoon: expiringSoon && expiringSoon.points > 0 ? expiringSoon : null,
    pendingPoints: pending?.points ?? 0,
  }
}

export type PointsEntryView = {
  id: string
  source: Source
  status: Status
  points: number
  reason: string
  staffEmail: string | null
  orderId: string | null
  orderNumber: number | null
  /** The last day these points can be spent (`YYYY-MM-DD`), when credited with an expiry. */
  expiresOn: string | null
  /** When pending points land. */
  availableAt: Date
  createdAt: Date
}

/** The customer's points history, newest first (cancelled entries included, marked). */
export async function pointsHistory(
  ctx: StoreContext,
  customerId: string,
  limit = 50,
): Promise<PointsEntryView[]> {
  const timeZone = await storeCreditTimeZone(ctx)
  const rows = await ctx.tx
    .select({
      id: loyaltyEntry.id,
      source: loyaltyEntry.source,
      status: loyaltyEntry.status,
      points: loyaltyEntry.points,
      reason: loyaltyEntry.reason,
      staffEmail: loyaltyEntry.staffEmail,
      orderId: loyaltyEntry.orderId,
      orderNumber: order.number,
      expiresAt: loyaltyEntry.expiresAt,
      availableAt: loyaltyEntry.availableAt,
      createdAt: loyaltyEntry.createdAt,
    })
    .from(loyaltyEntry)
    .leftJoin(order, eq(order.id, loyaltyEntry.orderId))
    .where(eq(loyaltyEntry.customerId, customerId))
    .orderBy(desc(loyaltyEntry.createdAt), desc(loyaltyEntry.id))
    .limit(limit)
  return rows.map(({ expiresAt, ...r }) => ({
    ...r,
    expiresOn: expiresAt ? storeCreditLastDay(expiresAt, timeZone) : null,
  }))
}

/** The admin's customer card: points, history and the birthday. */
export async function customerPoints(ctx: StoreContext, customerId: string) {
  const [c] = await ctx.tx
    .select({ birthday: customer.birthday })
    .from(customer)
    .where(eq(customer.id, customerId))
  if (!c) throw new StoreCreditError('not_found', 'Customer not found', ctx.storeId)
  return {
    ...(await pointsSummary(ctx, customerId)),
    birthday: c.birthday,
    entries: await pointsHistory(ctx, customerId),
  }
}

/**
 * Staff add (positive) or remove (negative) points with a reason. Added points expire like
 * earned ones; a removal can take no more than the customer's points balance. One `adjustment`
 * entry and one `loyalty` store credit line, in the caller's transaction.
 */
export async function adjustPoints(
  ctx: StoreContext,
  input: { customerId: string; points: number; reason: string; staffEmail: string | null },
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<PointsSummary> {
  const reason = input.reason.trim().slice(0, 200)
  if (!Number.isInteger(input.points) || input.points === 0) {
    throw new StoreCreditError('invalid', 'Enter a number of points', ctx.storeId)
  }
  if (!reason) throw new StoreCreditError('invalid', 'Give a reason', ctx.storeId)
  let storeCreditEntryId: string
  let expiresAt: Date | null = null
  if (input.points > 0) {
    const done = await creditPoints(
      ctx,
      { customerId: input.customerId, points: input.points, reason },
      settings,
      now,
    )
    storeCreditEntryId = done.storeCreditEntryId
    expiresAt = done.expiresAt
  } else {
    // Lock the account first, so the balance read below cannot change before the removal.
    await lockStoreCreditBalance(ctx, input.customerId, now)
    const { points } = await pointsSummary(ctx, input.customerId, 0, now)
    if (-input.points > points) {
      throw new StoreCreditError('insufficient', 'That is more points than they have.', ctx.storeId)
    }
    const line = await changeStoreCredit(
      ctx,
      {
        customerId: input.customerId,
        amountPaise: input.points * POINT_PAISE,
        kind: 'loyalty',
        reason,
        staff: { email: input.staffEmail },
      },
      now,
    )
    storeCreditEntryId = line.entryId
  }
  await ctx.tx.insert(loyaltyEntry).values({
    storeId: ctx.storeId,
    customerId: input.customerId,
    source: 'adjustment',
    status: 'credited',
    points: input.points,
    reason,
    staffEmail: input.staffEmail,
    availableAt: now,
    creditedAt: now,
    storeCreditEntryId,
    expiresAt,
  })
  return pointsSummary(ctx, input.customerId, 30, now)
}

/** The app's overview: points given and taken, customers holding points, points on the way. */
export async function loyaltyOverview(ctx: StoreContext, days = 30, now: Date = new Date()) {
  const since = new Date(now.getTime() - days * DAY_MS)
  const [row] = await ctx.tx
    .select({
      earned: sql<number>`coalesce(sum(${loyaltyEntry.points}) filter (where ${loyaltyEntry.status} = 'credited' and ${loyaltyEntry.points} > 0), 0)::int`,
      takenBack: sql<number>`coalesce(-sum(${loyaltyEntry.points}) filter (where ${loyaltyEntry.status} = 'credited' and ${loyaltyEntry.points} < 0), 0)::int`,
      customers: sql<number>`count(distinct ${loyaltyEntry.customerId}) filter (where ${loyaltyEntry.status} = 'credited')::int`,
    })
    .from(loyaltyEntry)
    .where(gt(loyaltyEntry.createdAt, since))
  const [pending] = await ctx.tx
    .select({ points: sql<number>`coalesce(sum(${loyaltyEntry.points}), 0)::int` })
    .from(loyaltyEntry)
    .where(eq(loyaltyEntry.status, 'pending'))
  const recent = await ctx.tx
    .select({
      id: loyaltyEntry.id,
      customerId: loyaltyEntry.customerId,
      customerName: customer.name,
      customerEmail: customer.email,
      source: loyaltyEntry.source,
      status: loyaltyEntry.status,
      points: loyaltyEntry.points,
      reason: loyaltyEntry.reason,
      createdAt: loyaltyEntry.createdAt,
    })
    .from(loyaltyEntry)
    .innerJoin(customer, eq(customer.id, loyaltyEntry.customerId))
    .orderBy(desc(loyaltyEntry.createdAt), desc(loyaltyEntry.id))
    .limit(25)
  return {
    days,
    earnedPoints: row?.earned ?? 0,
    takenBackPoints: row?.takenBack ?? 0,
    customers: row?.customers ?? 0,
    pendingPoints: pending?.points ?? 0,
    recent,
  }
}

export type ShopperPointsEntry = Omit<PointsEntryView, 'reason' | 'staffEmail' | 'orderId'>

/**
 * The shopper's own Points page: the summary, the birthday and the history with the order each
 * line belongs to. Never the reason or the staff member (staff reasons are for the store only).
 */
export async function shopperPoints(ctx: StoreContext, customerId: string) {
  const [c] = await ctx.tx
    .select({ birthday: customer.birthday })
    .from(customer)
    .where(eq(customer.id, customerId))
  const entries: ShopperPointsEntry[] = (await pointsHistory(ctx, customerId, 30)).map((e) => ({
    id: e.id,
    source: e.source,
    status: e.status,
    points: e.points,
    orderNumber: e.orderNumber,
    expiresOn: e.expiresOn,
    availableAt: e.availableAt,
    createdAt: e.createdAt,
  }))
  return {
    ...(await pointsSummary(ctx, customerId)),
    birthday: c?.birthday ?? null,
    entries,
  }
}
