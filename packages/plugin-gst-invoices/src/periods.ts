import type { StoreTx } from '@commerce/db'
import { and, eq, gte, inArray, lt, ne } from 'drizzle-orm'
import { invoice, invoicePeriod } from './schema'

const IST_OFFSET_MS = 330 * 60 * 1000

/** `2026-09`: the IST calendar month an instant falls in, which is its GST return period. */
export function periodOf(at: Date): string {
  const ist = new Date(at.getTime() + IST_OFFSET_MS)
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`
}

/** [start, end) of a `YYYY-MM` period as instants (midnight IST). */
export function periodRange(period: string): { from: Date; to: Date } {
  const [y, m] = period.split('-').map(Number) as [number, number]
  const from = new Date(Date.UTC(y, m - 1, 1) - IST_OFFSET_MS)
  const to = new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS)
  return { from, to }
}

export class PeriodError extends Error {
  constructor(
    readonly code: 'closed' | 'reported',
    message: string,
  ) {
    super(message)
  }
}

const label = (period: string) => {
  const { from } = periodRange(period)
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(from.getTime() + 86_400_000))
}

export async function getPeriod(tx: StoreTx, storeId: string, period: string) {
  const [row] = await tx
    .select()
    .from(invoicePeriod)
    .where(and(eq(invoicePeriod.storeId, storeId), eq(invoicePeriod.period, period)))
  return row ?? null
}

/** Refuse to date a document into a month the merchant closed. */
export async function assertPeriodOpen(tx: StoreTx, storeId: string, at: Date): Promise<void> {
  const period = periodOf(at)
  const row = await getPeriod(tx, storeId, period)
  if (row?.closedAt) {
    throw new PeriodError('closed', `${label(period)} is closed; reopen it or pick a later date`)
  }
}

async function upsert(
  tx: StoreTx,
  storeId: string,
  period: string,
  set: Partial<typeof invoicePeriod.$inferInsert>,
) {
  await tx
    .insert(invoicePeriod)
    .values({ storeId, period, ...set })
    .onConflictDoUpdate({ target: [invoicePeriod.storeId, invoicePeriod.period], set })
}

/**
 * Mark a month's GSTR-1 as filed. Every invoice and credit note dated in it
 * becomes reported: it can no longer be cancelled, only corrected by a
 * credit note (or an amendment on the portal).
 */
export async function markFiled(tx: StoreTx, storeId: string, period: string, filed: boolean) {
  await upsert(tx, storeId, period, { gstr1FiledAt: filed ? new Date() : null })
  const { from, to } = periodRange(period)
  await tx
    .update(invoice)
    .set({ reportedPeriod: filed ? period : null, updatedAt: new Date() })
    .where(
      and(
        inArray(invoice.kind, ['tax_invoice', 'credit_note']),
        ne(invoice.status, 'draft'),
        gte(invoice.invoiceDate, from),
        lt(invoice.invoiceDate, to),
      ),
    )
}

/** Close or reopen a month: while closed nothing can be issued or backdated into it. */
export async function setClosed(tx: StoreTx, storeId: string, period: string, closed: boolean) {
  await upsert(tx, storeId, period, { closedAt: closed ? new Date() : null })
}

export async function listPeriods(tx: StoreTx, storeId: string) {
  return tx
    .select()
    .from(invoicePeriod)
    .where(eq(invoicePeriod.storeId, storeId))
    .orderBy(invoicePeriod.period)
}
