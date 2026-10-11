/** SOURCE OF TRUTH: peekNext, nextNumberFloor, setNextNumber — WHAT: reading and moving a GSTIN series' next invoice number / WHY: split from queue.ts; the counter rules (never below the last issued, never backwards in time) live in one place */
import { startOfDay } from '@commerce/dates'
import type { StoreTx } from '@commerce/db'
import { counterYear, financialYear, nextNumberProblem, type Series } from '@commerce/invoices'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { InvoiceError } from './issue'
import { sameRegistration } from './registration'
import { invoice, invoiceSequence } from './schema'

/**
 * The number a GSTIN's series counter hands out next, without taking it; `fyStartYear` is
 * its {@link counterYear}. `gstRegistrationId` null is a store without a registration.
 */
export async function peekNext(
  tx: StoreTx,
  gstRegistrationId: string | null,
  seriesId: string,
  fyStartYear: number,
): Promise<number> {
  const [row] = await tx
    .select({ next: invoiceSequence.next })
    .from(invoiceSequence)
    .where(
      and(
        sameRegistration(invoiceSequence.gstRegistrationId, gstRegistrationId),
        eq(invoiceSequence.seriesId, seriesId),
        eq(invoiceSequence.fyStartYear, fyStartYear),
      ),
    )
  return row?.next ?? 1
}

/**
 * The lowest next number a series may take in the financial year of `at`:
 * the higher of its yearly counter and its never-resetting one, so switching
 * "start again every April" on or off can never hand out a number twice.
 */
export async function nextNumberFloor(
  tx: StoreTx,
  gstRegistrationId: string | null,
  series: Pick<Series, 'id'>,
  at: Date,
): Promise<number> {
  const fy = financialYear(at)
  return Math.max(
    await peekNext(tx, gstRegistrationId, series.id, fy.startYear),
    await peekNext(tx, gstRegistrationId, series.id, 0),
  )
}

/**
 * Move a series' counter so its next document takes `wanted` (Settings ›
 * Taxes & GST). Refuses numbers below {@link nextNumberFloor}; the counter
 * row is upserted under the same lock issuing takes.
 */
export async function setNextNumber(
  tx: StoreTx,
  storeId: string,
  gstRegistrationId: string | null,
  series: Series,
  wanted: number,
  at = new Date(),
): Promise<number> {
  const floor = await nextNumberFloor(tx, gstRegistrationId, series, at)
  const problem = nextNumberProblem(floor, wanted)
  if (problem) throw new InvoiceError('invalid', problem)
  const fyStartYear = counterYear(series, financialYear(at))
  await tx
    .insert(invoiceSequence)
    .values({
      storeId,
      gstRegistrationId,
      kind: series.kind,
      seriesId: series.id,
      fyStartYear,
      next: wanted,
    })
    .onConflictDoUpdate({
      target: [
        invoiceSequence.storeId,
        invoiceSequence.gstRegistrationId,
        invoiceSequence.seriesId,
        invoiceSequence.fyStartYear,
      ],
      set: { next: sql`greatest(${invoiceSequence.next}, ${wanted})` },
    })
  return wanted
}

export async function latestIssuedDate(
  tx: StoreTx,
  gstRegistrationId: string | null,
  seriesId: string,
  fyStartYear: number,
): Promise<Date | null> {
  const [row] = await tx
    .select({ at: invoice.invoiceDate })
    .from(invoice)
    .where(
      and(
        sameRegistration(invoice.gstRegistrationId, gstRegistrationId),
        eq(invoice.seriesId, seriesId),
        inArray(invoice.status, ['issued', 'cancelled']),
        eq(invoice.fyStartYear, fyStartYear),
      ),
    )
    .orderBy(desc(invoice.seq))
    .limit(1)
  return row?.at ?? null
}

export function startOfIstDay(at: Date): Date {
  return startOfDay(at)
}
