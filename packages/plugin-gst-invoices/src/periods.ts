import { formatInZone, IST_OFFSET_MS } from '@commerce/dates'
import type { StoreTx } from '@commerce/db'
import { and, eq, gte, inArray, lt, ne } from 'drizzle-orm'
import { sameRegistration } from './registration'
import { invoice, invoicePeriod } from './schema'

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
  return formatInZone(from.getTime() + 86_400_000, { month: 'long', year: 'numeric' })
}

/** One GSTIN's return month; `gstRegistrationId` null is a store without a registration. */
export async function getPeriod(
  tx: StoreTx,
  storeId: string,
  period: string,
  gstRegistrationId: string | null,
) {
  const [row] = await tx
    .select()
    .from(invoicePeriod)
    .where(
      and(
        eq(invoicePeriod.storeId, storeId),
        sameRegistration(invoicePeriod.gstRegistrationId, gstRegistrationId),
        eq(invoicePeriod.period, period),
      ),
    )
  return row ?? null
}

/** Refuse to date a document into a month the merchant closed for this GSTIN. */
export async function assertPeriodOpen(
  tx: StoreTx,
  storeId: string,
  at: Date,
  gstRegistrationId: string | null,
): Promise<void> {
  const period = periodOf(at)
  const row = await getPeriod(tx, storeId, period, gstRegistrationId)
  if (row?.closedAt) {
    throw new PeriodError('closed', `${label(period)} is closed; reopen it or pick a later date`)
  }
}

async function upsert(
  tx: StoreTx,
  storeId: string,
  period: string,
  gstRegistrationId: string | null,
  set: Partial<typeof invoicePeriod.$inferInsert>,
) {
  await tx
    .insert(invoicePeriod)
    .values({ storeId, gstRegistrationId, period, ...set })
    .onConflictDoUpdate({
      target: [invoicePeriod.storeId, invoicePeriod.gstRegistrationId, invoicePeriod.period],
      set,
    })
}

/**
 * Mark one GSTIN's GSTR-1 for a month as filed. Every invoice and credit note
 * of that GSTIN dated in it becomes reported: it can no longer be cancelled,
 * only corrected by a credit note (or an amendment on the portal).
 */
export async function markFiled(
  tx: StoreTx,
  storeId: string,
  period: string,
  filed: boolean,
  gstRegistrationId: string | null,
) {
  await upsert(tx, storeId, period, gstRegistrationId, {
    gstr1FiledAt: filed ? new Date() : null,
  })
  const { from, to } = periodRange(period)
  await tx
    .update(invoice)
    .set({ reportedPeriod: filed ? period : null, updatedAt: new Date() })
    .where(
      and(
        sameRegistration(invoice.gstRegistrationId, gstRegistrationId),
        inArray(invoice.kind, ['tax_invoice', 'credit_note']),
        ne(invoice.status, 'draft'),
        gte(invoice.invoiceDate, from),
        lt(invoice.invoiceDate, to),
      ),
    )
}

/** Close or reopen one GSTIN's month: while closed nothing can be issued or backdated into it. */
export async function setClosed(
  tx: StoreTx,
  storeId: string,
  period: string,
  closed: boolean,
  gstRegistrationId: string | null,
) {
  await upsert(tx, storeId, period, gstRegistrationId, { closedAt: closed ? new Date() : null })
}

export async function listPeriods(tx: StoreTx, storeId: string, gstRegistrationId: string | null) {
  return tx
    .select()
    .from(invoicePeriod)
    .where(
      and(
        eq(invoicePeriod.storeId, storeId),
        sameRegistration(invoicePeriod.gstRegistrationId, gstRegistrationId),
      ),
    )
    .orderBy(invoicePeriod.period)
}
