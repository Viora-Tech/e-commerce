/** SOURCE OF TRUTH: where loyalty points live — WHAT: points on the store credit balance (`loyalty` lines, v1 and the default) or held only in the points ledger when the store turns "points spend as store credit" off; the replay of ledger-only points (oldest expiry spent first), and adding or taking points in either home under the member lock / WHY: rewards, refunds, imports, resets and staff changes all move points, and each must land in the right home exactly once */
import { loyaltyEntry } from '@commerce/db'
import { and, asc, eq, isNull } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { changeStoreCredit } from '../customers/store-credit'
import { lockStoreCreditBalance } from '../customers/store-credit-expiry'
import { LoyaltyError } from './errors'
import { backedPointsSummary } from './ledger'
import { lockMember } from './member'
import { type LoyaltySettings, POINT_PAISE, pointsExpiryAt } from './settings'

type EntryRow = typeof loyaltyEntry.$inferSelect
type Source = EntryRow['source']

/** One ledger-only line as the replay needs it. */
export type LedgerLine = {
  id: string
  points: number
  source: Source
  earnKey: string | null
  expiresAt: Date | null
  createdAt: Date
}

/** What is left of one ledger-only credit. */
export type PointsLot = { entryId: string; remaining: number; expiresAt: Date | null }

const EXPIRY_KEY = 'expiry:'

/**
 * Replays ledger-only lines (oldest first) into what is left of each credit. A taking line
 * spends the credits alive at its time, soonest expiry first (never-expiring last); an
 * `expiry` line (`earn_key` `expiry:<entry id>`) empties the one credit it names. Credits past
 * their expiry at `now` are left out, recorded or not. Pure.
 */
export function replayLedgerLots(lines: readonly LedgerLine[], now: Date): PointsLot[] {
  const sorted = [...lines].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  )
  const lots: PointsLot[] = []
  for (const line of sorted) {
    if (line.points > 0) {
      lots.push({ entryId: line.id, remaining: line.points, expiresAt: line.expiresAt })
      continue
    }
    if (line.source === 'expiry' && line.earnKey?.startsWith(EXPIRY_KEY)) {
      const lot = lots.find((l) => l.entryId === line.earnKey?.slice(EXPIRY_KEY.length))
      if (lot) lot.remaining = Math.max(0, lot.remaining + line.points)
      continue
    }
    let owed = -line.points
    const alive = lots
      .filter((l) => l.remaining > 0 && (!l.expiresAt || l.expiresAt > line.createdAt))
      .sort(
        (a, b) =>
          (a.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY) -
          (b.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY),
      )
    for (const lot of alive) {
      if (owed <= 0) break
      const take = Math.min(owed, lot.remaining)
      lot.remaining -= take
      owed -= take
    }
  }
  return lots.filter(
    (l) => l.remaining > 0 && (!l.expiresAt || l.expiresAt.getTime() > now.getTime()),
  )
}

/** The customer's ledger-only credits still open at `now`. */
export async function ledgerLots(
  ctx: StoreContext,
  customerId: string,
  now: Date = new Date(),
): Promise<PointsLot[]> {
  const lines = await ctx.tx
    .select({
      id: loyaltyEntry.id,
      points: loyaltyEntry.points,
      source: loyaltyEntry.source,
      earnKey: loyaltyEntry.earnKey,
      expiresAt: loyaltyEntry.expiresAt,
      createdAt: loyaltyEntry.createdAt,
    })
    .from(loyaltyEntry)
    .where(
      and(
        eq(loyaltyEntry.customerId, customerId),
        eq(loyaltyEntry.status, 'credited'),
        isNull(loyaltyEntry.storeCreditEntryId),
      ),
    )
    .orderBy(asc(loyaltyEntry.createdAt), asc(loyaltyEntry.id))
  return replayLedgerLots(lines, now)
}

/** Points held only in the ledger (not on the store credit balance). */
export async function ledgerPoints(
  ctx: StoreContext,
  customerId: string,
  now: Date = new Date(),
): Promise<number> {
  return (await ledgerLots(ctx, customerId, now)).reduce((n, l) => n + l.remaining, 0)
}

/**
 * Puts `points` on the customer's store credit balance as one `loyalty` line that runs out
 * `expiryMonths` later. In the caller's transaction, under the account lock.
 */
export async function creditPoints(
  ctx: StoreContext,
  input: { customerId: string; points: number; reason: string; orderId?: string | null },
  settings: LoyaltySettings,
  now: Date,
): Promise<{ storeCreditEntryId: string; expiresAt: Date | null }> {
  const expiresAt = pointsExpiryAt(now, settings.expiryMonths)
  const done = await changeStoreCredit(
    ctx,
    {
      customerId: input.customerId,
      amountPaise: input.points * POINT_PAISE,
      kind: 'loyalty',
      reason: input.reason,
      orderId: input.orderId ?? null,
      expiresAt,
    },
    now,
  )
  return { storeCreditEntryId: done.entryId, expiresAt }
}

export type PointsMove = {
  customerId: string
  points: number
  source: Source
  reason: string
  staffEmail?: string | null
  orderId?: string | null
  redemptionId?: string | null
  referralId?: string | null
  ruleId?: string | null
  /** A once-only key; put on the first entry written (a second move with it fails the insert). */
  earnKey?: string | null
}

/**
 * Gives points now, credited, in the store's home for points (store credit when "points spend
 * as store credit" is on, the ledger otherwise), expiring like earned points. Returns the entry.
 */
export async function addPoints(
  ctx: StoreContext,
  input: PointsMove,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<EntryRow> {
  if (!Number.isInteger(input.points) || input.points <= 0) {
    throw new LoyaltyError('invalid', 'Points to add must be a whole number above 0', ctx.storeId)
  }
  await lockMember(ctx, input.customerId, now)
  let storeCreditEntryId: string | null = null
  let expiresAt = pointsExpiryAt(now, settings.expiryMonths)
  if (settings.pointsAsStoreCredit) {
    const done = await creditPoints(ctx, input, settings, now)
    storeCreditEntryId = done.storeCreditEntryId
    expiresAt = done.expiresAt
  }
  const [row] = await ctx.tx
    .insert(loyaltyEntry)
    .values({
      storeId: ctx.storeId,
      customerId: input.customerId,
      source: input.source,
      status: 'credited',
      points: input.points,
      reason: input.reason.slice(0, 200),
      staffEmail: input.staffEmail ?? null,
      orderId: input.orderId ?? null,
      redemptionId: input.redemptionId ?? null,
      referralId: input.referralId ?? null,
      ruleId: input.ruleId ?? null,
      earnKey: input.earnKey ?? null,
      availableAt: now,
      creditedAt: now,
      storeCreditEntryId,
      expiresAt,
      createdAt: now,
    })
    .returning()
  if (!row) throw new Error('Could not record points')
  return row
}

/** Points the customer can spend now in both homes, under the member and account locks. */
async function lockedHoldings(ctx: StoreContext, customerId: string, now: Date) {
  await lockMember(ctx, customerId, now)
  await lockStoreCreditBalance(ctx, customerId, now)
  const backed = (await backedPointsSummary(ctx, customerId, 0, now)).points
  const ledger = await ledgerPoints(ctx, customerId, now)
  return { backed, ledger }
}

/**
 * Takes `points` from the customer: ledger-only points first (they cannot pay at checkout),
 * then store credit points as a negative `loyalty` line. Refuses (`insufficient`) more than
 * they hold, unless `upTo` is set, which takes what there is. One or two entries; returns the
 * points taken.
 */
export async function takePoints(
  ctx: StoreContext,
  input: PointsMove & { upTo?: boolean },
  now: Date = new Date(),
): Promise<{ taken: number; entryIds: string[] }> {
  if (!Number.isInteger(input.points) || input.points <= 0) {
    throw new LoyaltyError('invalid', 'Points to take must be a whole number above 0', ctx.storeId)
  }
  const { backed, ledger } = await lockedHoldings(ctx, input.customerId, now)
  const want = input.upTo ? Math.min(input.points, backed + ledger) : input.points
  if (want > backed + ledger) {
    throw new LoyaltyError('insufficient', 'Not enough points', ctx.storeId)
  }
  const fromLedger = Math.min(want, ledger)
  const fromCredit = want - fromLedger
  const base = {
    storeId: ctx.storeId,
    customerId: input.customerId,
    source: input.source,
    status: 'credited' as const,
    reason: input.reason.slice(0, 200),
    staffEmail: input.staffEmail ?? null,
    orderId: input.orderId ?? null,
    redemptionId: input.redemptionId ?? null,
    referralId: input.referralId ?? null,
    ruleId: input.ruleId ?? null,
    availableAt: now,
    creditedAt: now,
    createdAt: now,
  }
  const entryIds: string[] = []
  let earnKey = input.earnKey ?? null
  if (fromLedger > 0) {
    const [row] = await ctx.tx
      .insert(loyaltyEntry)
      .values({ ...base, earnKey, points: -fromLedger })
      .returning({ id: loyaltyEntry.id })
    if (row) entryIds.push(row.id)
    earnKey = null
  }
  if (fromCredit > 0) {
    const line = await changeStoreCredit(
      ctx,
      {
        customerId: input.customerId,
        amountPaise: -fromCredit * POINT_PAISE,
        kind: 'loyalty',
        reason: base.reason,
        orderId: base.orderId,
        staff: input.staffEmail ? { email: input.staffEmail } : null,
      },
      now,
    )
    const [row] = await ctx.tx
      .insert(loyaltyEntry)
      .values({ ...base, earnKey, points: -fromCredit, storeCreditEntryId: line.entryId })
      .returning({ id: loyaltyEntry.id })
    if (row) entryIds.push(row.id)
  }
  return { taken: want, entryIds }
}
