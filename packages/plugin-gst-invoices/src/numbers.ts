/** SOURCE OF TRUTH: takeNumber — WHAT the one place a GST document number is taken / WHY rule
 * 46(b) wants consecutive numbers, unique per GSTIN per financial year: the counter row is
 * locked by the upsert until the issuing transaction ends, so concurrent issuers queue, a
 * rollback hands the number back, and each GSTIN counts on its own.
 */
import type { StoreTx } from '@commerce/db'
import {
  counterYear,
  financialYear,
  formatSeriesNumber,
  type InvoiceSettings,
  type NumberedKind,
  pickSeries,
  type SeriesContext,
} from '@commerce/invoices'
import { sql } from 'drizzle-orm'
import { InvoiceError } from './issue'
import { gstToken, type Issuer } from './registration'
import { invoiceSequence } from './schema'

/**
 * Take the next number in a series of the issuing GSTIN. The upsert locks the
 * sequence row until the surrounding transaction ends, so a concurrent issuer
 * waits and then gets the following number; a rollback returns the number
 * unused. Numbers therefore never repeat and never skip (rule 46(b)), and
 * each GSTIN counts on its own.
 */
export async function takeNumber(
  tx: StoreTx,
  storeId: string,
  kind: NumberedKind,
  at: Date,
  settings: InvoiceSettings,
  ctx: SeriesContext,
  issuer: Issuer,
): Promise<{
  number: string
  seq: number
  fyStartYear: number
  seriesId: string
  gstRegistrationId: string | null
}> {
  const series = pickSeries(settings.series, kind, ctx)
  if (!series)
    throw new InvoiceError('invalid', `No ${kind.replace('_', ' ')} series matches this order`)
  const fy = financialYear(at)
  const gstRegistrationId = issuer?.id ?? null
  const [row] = await tx
    .insert(invoiceSequence)
    .values({
      storeId,
      gstRegistrationId,
      kind,
      seriesId: series.id,
      fyStartYear: counterYear(series, fy),
      next: 2,
    })
    .onConflictDoUpdate({
      target: [
        invoiceSequence.storeId,
        invoiceSequence.gstRegistrationId,
        invoiceSequence.seriesId,
        invoiceSequence.fyStartYear,
      ],
      set: { next: sql`${invoiceSequence.next} + 1` },
    })
    .returning({ next: invoiceSequence.next })
  if (!row) throw new Error('sequence upsert returned nothing')
  const seq = row.next - 1
  return {
    number: formatSeriesNumber(series, fy, seq, gstToken(issuer, settings)),
    seq,
    fyStartYear: fy.startYear,
    seriesId: series.id,
    gstRegistrationId,
  }
}
