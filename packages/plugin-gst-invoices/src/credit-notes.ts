/** SOURCE OF TRUTH: issueCreditNotes, issueCreditNote, creditNoteCutoff — WHAT: the credit notes a refund produces (one per GSTIN supply it reduces) and the s.34(2) deadline / WHY: split from issue.ts so invoices and credit notes each stay small; issue.ts holds the shared document writers */
import { refund, type StoreTx } from '@commerce/db'
import { buildCreditNote, DocumentSnapshotSchema, financialYear } from '@commerce/invoices'
import { and, eq, ne, sql } from 'drizzle-orm'
import {
  InvoiceError,
  type InvoiceRow,
  insertDocument,
  liveDocuments,
  loadSettings,
  seriesContextOf,
} from './issue'
import { takeNumber } from './numbers'
import { assertPeriodOpen } from './periods'
import { allocateRefund, refundReturnedUnits, refundWeights } from './refund-allocation'
import { documentIssuer } from './registration'
import { invoice } from './schema'

/**
 * The last moment a credit note may be issued for a supply (CGST s.34(2)):
 * 30 November after the end of the financial year of the invoice, or the
 * annual return filing date if earlier.
 */
export function creditNoteCutoff(invoiceDate: Date, gstr9FiledOn: string | null): Date {
  const fyStart = financialYear(invoiceDate).startYear
  // 30 November of the year the FY ends, end of day IST.
  const nov30 = new Date(Date.UTC(fyStart + 1, 10, 30, 18, 29, 59))
  if (!gstr9FiledOn) return nov30
  const annual = new Date(`${gstr9FiledOn}T23:59:59+05:30`)
  return annual.getTime() < nov30.getTime() ? annual : nov30
}

/**
 * The credit notes for a refund (rule 53(1A)), idempotent on the refund. One invoice: one credit
 * note against it, as always. An order billed in parcels under several GSTINs: one credit note
 * per GSTIN whose supply the refund reduces (REFUND_ALLOCATION, refund-allocation.ts), each from
 * the GSTIN of the invoice it corrects, in that GSTIN's series. Empty when nothing was invoiced.
 */
export async function issueCreditNotes(
  tx: StoreTx,
  storeId: string,
  refundId: string,
  opts: { at?: Date } = {},
): Promise<{ row: InvoiceRow; created: boolean }[]> {
  const notesOf = () => tx.select().from(invoice).where(eq(invoice.refundId, refundId))
  const prior = await notesOf()
  if (prior.length) return prior.map((row) => ({ row, created: false }))
  const [r] = await tx.select().from(refund).where(eq(refund.id, refundId))
  if (!r || r.status === 'failed') return []
  const invoices = (await liveDocuments(tx, r.orderId, 'tax_invoice')).filter(
    (d) => d.status === 'issued',
  )
  if (invoices.length === 0) return []
  const settings = await loadSettings(tx, storeId)
  if (!settings.documents.credit_note.enabled) return []
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`gst-invoices:refund:${refundId}`}))`,
  )
  const again = await notesOf()
  if (again.length) return again.map((row) => ({ row, created: false }))
  const at = opts.at ?? new Date()

  // What each invoice can still be credited: its total less the credit notes already against it.
  // Without this, two refunds on a one-invoice order could credit more GST than was charged.
  const credited = await tx
    .select({ fulfillmentOrderId: invoice.fulfillmentOrderId, totalPaise: invoice.totalPaise })
    .from(invoice)
    .where(
      and(
        eq(invoice.orderId, r.orderId),
        eq(invoice.kind, 'credit_note'),
        ne(invoice.status, 'cancelled'),
      ),
    )
  const capacityOf = (inv: InvoiceRow) =>
    inv.totalPaise -
    credited
      .filter((c) => c.fulfillmentOrderId === inv.fulfillmentOrderId)
      .reduce((n, c) => n + c.totalPaise, 0)

  // How much of the refund each invoice takes: all of it with one invoice, up to what is left.
  let amounts: Map<string, number>
  const [only] = invoices
  if (invoices.length === 1 && only) {
    amounts = new Map([[only.id, Math.min(r.amountPaise, capacityOf(only))]])
  } else {
    const weights = await refundWeights(tx, r.orderId, refundId)
    amounts = allocateRefund(
      r.amountPaise,
      invoices.map((inv) => ({
        key: inv.id,
        capacityPaise: capacityOf(inv),
        weight: inv.fulfillmentOrderId ? (weights.get(inv.fulfillmentOrderId) ?? 0) : 0,
      })),
    )
  }

  // A refund for a return credits the units that came back, on the invoice that billed them.
  const returned = await refundReturnedUnits(tx, r.orderId, refundId)
  const out: { row: InvoiceRow; created: boolean }[] = []
  for (const original of invoices) {
    const amountPaise = amounts.get(original.id) ?? 0
    if (amountPaise <= 0) continue
    // A credit note comes from the GSTIN that issued the invoice it corrects.
    await assertPeriodOpen(tx, storeId, at, original.gstRegistrationId)
    const cutoff = creditNoteCutoff(
      original.invoiceDate ?? original.issuedAt,
      settings.gstr9FiledOn,
    )
    if (at.getTime() > cutoff.getTime()) {
      throw new InvoiceError(
        'expired',
        `Credit notes for ${original.number} were allowed until ${cutoff.toISOString().slice(0, 10)} (section 34(2)). Refund without a credit note and keep the record.`,
      )
    }
    const invoiceDoc = DocumentSnapshotSchema.parse(original.snapshot)
    const n = await takeNumber(
      tx,
      storeId,
      'credit_note',
      at,
      settings,
      seriesContextOf(invoiceDoc),
      await documentIssuer(tx, original.gstRegistrationId),
    )
    const doc = buildCreditNote({
      invoice: invoiceDoc,
      number: n.number,
      issuedAt: at,
      amountPaise,
      reason: r.reason,
      returned:
        invoices.length === 1
          ? returned.all
          : original.fulfillmentOrderId
            ? (returned.byParcel.get(original.fulfillmentOrderId) ?? [])
            : [],
    })
    const row = await insertDocument(tx, storeId, doc, {
      refundId,
      gstRegistrationId: original.gstRegistrationId,
      fulfillmentOrderId: original.fulfillmentOrderId,
      seq: n.seq,
      fyStartYear: n.fyStartYear,
      seriesId: n.seriesId,
    })
    if (!row) throw new Error('credit note insert raced past the advisory lock')
    out.push({ row, created: true })
  }
  return out
}

/** `issueCreditNotes` for an order with one invoice: its credit note, or null. */
export async function issueCreditNote(
  tx: StoreTx,
  storeId: string,
  refundId: string,
  opts: { at?: Date } = {},
): Promise<{ row: InvoiceRow; created: boolean } | null> {
  const [first] = await issueCreditNotes(tx, storeId, refundId, opts)
  return first ?? null
}
