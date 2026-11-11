/** SOURCE OF TRUTH: store credit expiry — WHAT: which credits with an expiry date still hold money (replayed from the append-only ledger, spending the soonest-to-expire first), taking what is left of each off the balance on its date with an `expiry` line, and the balance a reader should see before that line is written / WHY: expired credit must never be spendable, even in the minutes before the worker's sweep reaches it, and the ledger stays the single record of every rupee */
import { DEFAULT_TIME_ZONE, dayKey, dayStart, startOfDay } from '@commerce/dates'
import { store, storeCreditAccount, storeCreditEntry } from '@commerce/db'
import { and, asc, eq, isNotNull, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'

/*
 * How expiry works (owner, 12 Nov 2026):
 *
 * - Staff may give a credit an expiry date when they add it. No date never expires; refunds,
 *   returns and releases never expire.
 * - Spending takes from the credit that expires soonest first, then from credit that never
 *   expires. Nothing is stored for this: `openLots` replays the customer's ledger in order, so
 *   the ledger stays append-only and is the one record.
 * - On its date, whatever is left of a credit leaves the balance with an `expiry` line linked to
 *   that credit line (`expired_entry_id`, unique, so it can only happen once).
 * - When: every change to a balance first writes any expiry lines that are due, under the
 *   account's row lock (`expireDueStoreCredit`), so expired money can never be spent. The worker's
 *   sweep (`sweepExpiredStoreCredit`) writes them for accounts nobody touches, so the history
 *   shows them. Readers subtract anything due but not written yet (`dueStoreCreditPaise`), so the
 *   balance shown is right even before the sweep runs.
 */

/** The store's time zone, in which an expiry date's day ends. */
export async function storeCreditTimeZone(ctx: StoreContext): Promise<string> {
  const [s] = await ctx.tx
    .select({ timezone: store.timezone })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  return s?.timezone || DEFAULT_TIME_ZONE
}

/** A credit that expires "on" `YYYY-MM-DD` can be spent all that day: it ends at the next midnight. */
export function storeCreditExpiryAt(day: string, timeZone: string): Date {
  return startOfDay(dayStart(day, timeZone), timeZone, 1)
}

/** The last day a credit can be spent (`YYYY-MM-DD`, store time), from its `expires_at`. */
export function storeCreditLastDay(expiresAt: Date, timeZone: string): string {
  return dayKey(new Date(expiresAt.getTime() - 1), timeZone)
}

/** One ledger line, as much of it as the replay needs. */
export type StoreCreditLedgerLine = {
  id: string
  amountPaise: number
  kind: string
  expiresAt: Date | null
  expiredEntryId: string | null
}

/** A credit with an expiry date and what is still left of it. */
export type StoreCreditLot = { entryId: string; expiresAt: Date; remainingPaise: number }

/**
 * Replays a customer's ledger (oldest first) and returns each credit with an expiry date that
 * still has money left. A debit takes from the credit that expires soonest first; credit that
 * never expires is spent last. An `expiry` line empties the credit it names.
 */
export function openLots(lines: readonly StoreCreditLedgerLine[]): StoreCreditLot[] {
  const lots: StoreCreditLot[] = []
  for (const line of lines) {
    if (line.amountPaise > 0) {
      if (line.expiresAt) {
        lots.push({ entryId: line.id, expiresAt: line.expiresAt, remainingPaise: line.amountPaise })
      }
      continue
    }
    if (line.kind === 'expiry' && line.expiredEntryId) {
      const lot = lots.find((l) => l.entryId === line.expiredEntryId)
      if (lot) lot.remainingPaise = Math.max(0, lot.remainingPaise + line.amountPaise)
      continue
    }
    let left = -line.amountPaise
    const soonestFirst = lots
      .filter((l) => l.remainingPaise > 0)
      .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
    for (const lot of soonestFirst) {
      if (left <= 0) break
      const take = Math.min(left, lot.remainingPaise)
      lot.remainingPaise -= take
      left -= take
    }
  }
  return lots.filter((l) => l.remainingPaise > 0)
}

/** The credits whose date has come and that still hold money, soonest first. */
export function dueLots(lots: readonly StoreCreditLot[], now: Date): StoreCreditLot[] {
  return lots
    .filter((l) => l.expiresAt.getTime() <= now.getTime())
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
}

/** The customer's ledger in the order it was written (ids are time-ordered uuidv7). */
async function ledgerOf(ctx: StoreContext, customerId: string): Promise<StoreCreditLedgerLine[]> {
  return ctx.tx
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
}

/** Whether the customer has ever had a credit with an expiry date (most never have). */
async function hasExpiringCredit(ctx: StoreContext, customerId: string): Promise<boolean> {
  const [row] = await ctx.tx
    .select({ id: storeCreditEntry.id })
    .from(storeCreditEntry)
    .where(
      and(eq(storeCreditEntry.customerId, customerId), isNotNull(storeCreditEntry.expiresAt)),
    )
    .limit(1)
  return Boolean(row)
}

/** The customer's credits with an expiry date that still hold money, soonest first. */
export async function openStoreCreditLots(
  ctx: StoreContext,
  customerId: string,
): Promise<StoreCreditLot[]> {
  if (!(await hasExpiringCredit(ctx, customerId))) return []
  return openLots(await ledgerOf(ctx, customerId)).sort(
    (a, b) => a.expiresAt.getTime() - b.expiresAt.getTime(),
  )
}

/**
 * Expired credit not yet taken off the balance (the sweep or the next change writes it). A
 * reader subtracts this so the balance it shows is what the customer can really spend.
 */
export async function dueStoreCreditPaise(
  ctx: StoreContext,
  customerId: string,
  now: Date = new Date(),
): Promise<number> {
  const lots = await openStoreCreditLots(ctx, customerId)
  return dueLots(lots, now).reduce((sum, l) => sum + l.remainingPaise, 0)
}

/**
 * Writes the `expiry` line for every credit whose date has come and still holds money, and takes
 * it off the balance. The caller holds the account's row lock (`FOR UPDATE`). Returns the balance
 * after, and the total taken off.
 */
export async function expireDueStoreCredit(
  ctx: StoreContext,
  account: { id: string; customerId: string; balancePaise: number },
  now: Date = new Date(),
): Promise<{ balancePaise: number; expiredPaise: number }> {
  const lots = await openStoreCreditLots(ctx, account.customerId)
  let balance = account.balancePaise
  let expired = 0
  for (const lot of dueLots(lots, now)) {
    // The balance always covers what is left of a credit; the cap only guards odd old data.
    const amount = Math.min(lot.remainingPaise, balance)
    if (amount <= 0) continue
    balance -= amount
    expired += amount
    await ctx.tx.insert(storeCreditEntry).values({
      storeId: ctx.storeId,
      customerId: account.customerId,
      amountPaise: -amount,
      balanceAfterPaise: balance,
      kind: 'expiry',
      reason: 'Store credit expired',
      expiredEntryId: lot.entryId,
    })
  }
  if (expired > 0) {
    await ctx.tx
      .update(storeCreditAccount)
      .set({
        balancePaise: sql`${storeCreditAccount.balancePaise} - ${expired}`,
        updatedAt: now,
      })
      .where(eq(storeCreditAccount.id, account.id))
  }
  return { balancePaise: balance, expiredPaise: expired }
}

/**
 * Locks the customer's account row (`FOR UPDATE`; a checkout or convert for the same customer
 * waits here), takes off anything expired, and returns the balance that can be spent. 0 with
 * no account yet (nothing is created).
 */
export async function lockStoreCreditBalance(
  ctx: StoreContext,
  customerId: string,
  now: Date = new Date(),
): Promise<number> {
  const [account] = await ctx.tx
    .select({
      id: storeCreditAccount.id,
      customerId: storeCreditAccount.customerId,
      balancePaise: storeCreditAccount.balancePaise,
    })
    .from(storeCreditAccount)
    .where(
      and(
        eq(storeCreditAccount.storeId, ctx.storeId),
        eq(storeCreditAccount.customerId, customerId),
      ),
    )
    .for('update')
  if (!account) return 0
  return (await expireDueStoreCredit(ctx, account, now)).balancePaise
}

/**
 * The balance a customer can spend now, without writing anything: the stored balance less any
 * expired credit the sweep has not taken off yet.
 */
export async function spendableStoreCredit(
  ctx: StoreContext,
  customerId: string,
  now: Date = new Date(),
): Promise<number> {
  const [account] = await ctx.tx
    .select({ balancePaise: storeCreditAccount.balancePaise })
    .from(storeCreditAccount)
    .where(eq(storeCreditAccount.customerId, customerId))
  if (!account) return 0
  return Math.max(0, account.balancePaise - (await dueStoreCreditPaise(ctx, customerId, now)))
}

/**
 * The sweep for one store: every customer with a credit past its date and no expiry line yet
 * gets the line written, each under its account's row lock. Returns the customers and the total
 * taken off. Credits whose date passed more than 30 days ago are left to the next change (the
 * same window as `stores_with_store_credit_expiring`), so a spent credit is not looked at forever.
 */
export async function sweepExpiredStoreCredit(
  ctx: StoreContext,
  now: Date = new Date(),
): Promise<{ customers: number; expiredPaise: number }> {
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const rows = await ctx.tx.execute<{ customer_id: string }>(sql`
    select distinct e.customer_id from store_credit_entry e
    where e.store_id = ${ctx.storeId}
      and e.expires_at is not null
      and e.expires_at <= ${now.toISOString()}::timestamptz
      and e.expires_at > ${since.toISOString()}::timestamptz
      and not exists (select 1 from store_credit_entry x where x.expired_entry_id = e.id)`)
  let customers = 0
  let expiredPaise = 0
  for (const r of rows) {
    const [account] = await ctx.tx
      .select({
        id: storeCreditAccount.id,
        customerId: storeCreditAccount.customerId,
        balancePaise: storeCreditAccount.balancePaise,
      })
      .from(storeCreditAccount)
      .where(eq(storeCreditAccount.customerId, r.customer_id))
      .for('update')
    if (!account) continue
    const done = await expireDueStoreCredit(ctx, account, now)
    if (done.expiredPaise > 0) {
      customers += 1
      expiredPaise += done.expiredPaise
    }
  }
  return { customers, expiredPaise }
}
