/** SOURCE OF TRUTH: recording expired loyalty points — WHAT: an `expiry` entry for each points credit that ran out: ledger-only credits past their date (what was left of them), and store credit points the store credit expiry sweep already took (`expiry` lines of `loyalty` credits) / WHY: the balance already leaves expired points out; these rows make "points expired" in analytics and the history true, once each (`earn_key` `expiry:<id>`) */
import { loyaltyEntry, storeCreditEntry } from '@commerce/db'
import { aliasedTable, and, eq, isNull, lte, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { ledgerLots, replayLedgerLots } from './balance'
import { POINT_PAISE } from './settings'

/**
 * Writes the `expiry` entries due at `now` (at most `limit` customers' worth). Ledger-only
 * credits carry no store credit line; the entry names the credit it empties. Store credit
 * points get an entry pointing at the store credit `expiry` line (so it is never counted as
 * ledger points). Returns how many entries were written.
 */
export async function recordExpiredPoints(
  ctx: StoreContext,
  now: Date = new Date(),
  limit = 200,
): Promise<number> {
  let written = 0
  // Ledger-only credits whose date passed and that have no expiry entry yet.
  const candidates = await ctx.tx
    .selectDistinct({ customerId: loyaltyEntry.customerId })
    .from(loyaltyEntry)
    .where(
      and(
        eq(loyaltyEntry.status, 'credited'),
        isNull(loyaltyEntry.storeCreditEntryId),
        sql`${loyaltyEntry.points} > 0`,
        lte(loyaltyEntry.expiresAt, now),
        sql`not exists (select 1 from loyalty_entry x where x.store_id = ${loyaltyEntry.storeId}
          and x.customer_id = ${loyaltyEntry.customerId} and x.earn_key = 'expiry:' || ${loyaltyEntry.id}::text)`,
      ),
    )
    .limit(limit)
  for (const { customerId } of candidates) {
    // What was left of each credit the moment before it ran out.
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
    const open = new Set((await ledgerLots(ctx, customerId, now)).map((l) => l.entryId))
    const expired = lines.filter(
      (l) => l.points > 0 && l.expiresAt && l.expiresAt <= now && !open.has(l.id),
    )
    for (const lot of expired) {
      if (!lot.expiresAt) continue
      const atEnd = replayLedgerLots(
        lines.filter((l) => l.createdAt < (lot.expiresAt as Date)),
        new Date((lot.expiresAt as Date).getTime() - 1),
      ).find((l) => l.entryId === lot.id)
      const left = atEnd?.remaining ?? 0
      if (left <= 0) continue
      const rows = await ctx.tx
        .insert(loyaltyEntry)
        .values({
          storeId: ctx.storeId,
          customerId,
          source: 'expiry',
          status: 'credited',
          points: -left,
          earnKey: `expiry:${lot.id}`,
          reason: 'Points ran out',
          availableAt: lot.expiresAt,
          creditedAt: lot.expiresAt,
          createdAt: lot.expiresAt,
        })
        .onConflictDoNothing()
        .returning({ id: loyaltyEntry.id })
      written += rows.length
    }
  }
  // Store credit points: the store credit sweep's `expiry` lines on `loyalty` credits.
  const credited = aliasedTable(storeCreditEntry, 'credited_line')
  const lines = await ctx.tx
    .select({
      id: storeCreditEntry.id,
      customerId: storeCreditEntry.customerId,
      amountPaise: storeCreditEntry.amountPaise,
      createdAt: storeCreditEntry.createdAt,
    })
    .from(storeCreditEntry)
    .innerJoin(credited, eq(credited.id, storeCreditEntry.expiredEntryId))
    .where(
      and(
        eq(storeCreditEntry.kind, 'expiry'),
        eq(credited.kind, 'loyalty'),
        sql`not exists (select 1 from loyalty_entry x where x.store_id = ${storeCreditEntry.storeId}
          and x.customer_id = ${storeCreditEntry.customerId} and x.earn_key = 'expiry:' || ${storeCreditEntry.id}::text)`,
      ),
    )
    .limit(limit)
  for (const l of lines) {
    const points = Math.round(l.amountPaise / POINT_PAISE)
    if (points >= 0) continue
    const rows = await ctx.tx
      .insert(loyaltyEntry)
      .values({
        storeId: ctx.storeId,
        customerId: l.customerId,
        source: 'expiry',
        status: 'credited',
        points,
        earnKey: `expiry:${l.id}`,
        storeCreditEntryId: l.id,
        reason: 'Points ran out',
        availableAt: l.createdAt,
        creditedAt: l.createdAt,
        createdAt: l.createdAt,
      })
      .onConflictDoNothing()
      .returning({ id: loyaltyEntry.id })
    written += rows.length
  }
  return written
}
