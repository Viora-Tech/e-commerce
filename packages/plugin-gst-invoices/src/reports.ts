import type { StoreTx } from '@commerce/db'
import {
  buildGstr1,
  DocumentSnapshotSchema,
  type Gstr1CreditNote,
  type Gstr1Document,
  type Gstr1Export,
  gstr1CreditNote,
  gstr1Invoice,
} from '@commerce/invoices'
import { and, desc, eq, gte, ilike, inArray, lt, ne, or, type SQL } from 'drizzle-orm'
import { sameRegistration } from './registration'
import { invoice } from './schema'

export type ListFilter = {
  q?: string | undefined
  kind?:
    | 'tax_invoice'
    | 'credit_note'
    | 'packing_slip'
    | 'order_confirmation'
    | 'receipt_voucher'
    | 'refund_voucher'
    | undefined
  status?: 'issued' | 'cancelled' | undefined
  /** Inclusive start and exclusive end, as instants. */
  from?: Date | undefined
  to?: Date | undefined
  /** One GSTIN's documents (null: a store without a registration); undefined: every GSTIN. */
  gstRegistrationId?: string | null | undefined
}

function where(filter: ListFilter): SQL | undefined {
  const q = filter.q?.trim()
  // Drafts live in the queue, not in the issued list.
  return and(
    ne(invoice.status, 'draft'),
    filter.gstRegistrationId === undefined
      ? undefined
      : sameRegistration(invoice.gstRegistrationId, filter.gstRegistrationId),
    filter.kind ? eq(invoice.kind, filter.kind) : undefined,
    filter.status ? eq(invoice.status, filter.status) : undefined,
    filter.from ? gte(invoice.invoiceDate, filter.from) : undefined,
    filter.to ? lt(invoice.invoiceDate, filter.to) : undefined,
    q
      ? or(
          ilike(invoice.number, `%${q}%`),
          ilike(invoice.buyerName, `%${q}%`),
          ilike(invoice.buyerGstin, `%${q}%`),
        )
      : undefined,
  )
}

export async function listDocuments(
  tx: StoreTx,
  filter: ListFilter & { limit: number; offset: number },
) {
  const rows = await tx
    .select({
      id: invoice.id,
      orderId: invoice.orderId,
      kind: invoice.kind,
      number: invoice.number,
      buyerName: invoice.buyerName,
      buyerGstin: invoice.buyerGstin,
      totalPaise: invoice.totalPaise,
      taxPaise: invoice.cgstPaise,
      sgstPaise: invoice.sgstPaise,
      igstPaise: invoice.igstPaise,
      pdfStatus: invoice.pdfStatus,
      status: invoice.status,
      reportedPeriod: invoice.reportedPeriod,
      issuedAt: invoice.issuedAt,
      invoiceDate: invoice.invoiceDate,
      snapshot: invoice.snapshot,
    })
    .from(invoice)
    .where(where(filter))
    .orderBy(desc(invoice.invoiceDate), desc(invoice.seq), desc(invoice.id))
    .limit(filter.limit + 1)
    .offset(filter.offset)
  return {
    rows: rows.slice(0, filter.limit).map(({ snapshot, taxPaise, sgstPaise, igstPaise, ...r }) => {
      const doc = DocumentSnapshotSchema.safeParse(snapshot)
      return {
        ...r,
        taxPaise: taxPaise + sgstPaise + igstPaise,
        orderName: doc.success ? doc.data.order.name : '',
      }
    }),
    hasMore: rows.length > filter.limit,
  }
}

/** Ids for "select all matching": bulk actions by filter rather than by row. */
export async function documentIds(tx: StoreTx, filter: ListFilter, cap = 500): Promise<string[]> {
  const rows = await tx
    .select({ id: invoice.id })
    .from(invoice)
    .where(where(filter))
    .orderBy(invoice.invoiceDate)
    .limit(cap)
  return rows.map((r) => r.id)
}

export async function documentsByIds(tx: StoreTx, ids: readonly string[]) {
  if (ids.length === 0) return []
  return tx
    .select()
    .from(invoice)
    .where(inArray(invoice.id, [...ids]))
    .orderBy(invoice.issuedAt)
}

type InvoiceRow = typeof invoice.$inferSelect

/**
 * Everything one GSTIN's GSTR-1 for [from, to) is built from: the numbered documents dated in
 * it (cancelled ones too, for Table 13), its live invoices, and its credit notes paired with
 * the invoice each reverses, even when that invoice is from an earlier period. A note is paired
 * by the invoice number it prints, falling back to the order's invoice; notes with no invoice
 * are returned as orphans rather than dropped silently. `gstRegistrationId` null is a store
 * without a registration.
 */
export async function gstr1Inputs(
  tx: StoreTx,
  from: Date,
  to: Date,
  gstRegistrationId: string | null,
) {
  const inPeriod = await tx
    .select()
    .from(invoice)
    .where(
      and(
        sameRegistration(invoice.gstRegistrationId, gstRegistrationId),
        inArray(invoice.kind, ['tax_invoice', 'credit_note', 'receipt_voucher', 'refund_voucher']),
        inArray(invoice.status, ['issued', 'cancelled']),
        gte(invoice.invoiceDate, from),
        lt(invoice.invoiceDate, to),
      ),
    )
    .orderBy(invoice.invoiceDate, invoice.seq)
  const live = inPeriod.filter((r) => r.status === 'issued')
  const invoiceRows = live.filter((r) => r.kind === 'tax_invoice')
  const noteRows = live.filter((r) => r.kind === 'credit_note')
  const orderIds = [...new Set(noteRows.map((n) => n.orderId))]
  const originals = orderIds.length
    ? await tx
        .select()
        .from(invoice)
        .where(
          and(
            eq(invoice.kind, 'tax_invoice'),
            eq(invoice.status, 'issued'),
            inArray(invoice.orderId, orderIds),
          ),
        )
    : []
  const snap = (raw: unknown) => DocumentSnapshotSchema.parse(raw)
  const originalOf = (note: InvoiceRow, printed: string | null) => {
    const ofOrder = originals.filter((o) => o.orderId === note.orderId)
    return (printed ? ofOrder.find((o) => o.number === printed) : undefined) ?? ofOrder[0]
  }
  const creditNotes: { row: InvoiceRow; note: Gstr1CreditNote }[] = []
  const orphans: InvoiceRow[] = []
  for (const n of noteRows) {
    const s = snap(n.snapshot)
    const orig = originalOf(n, s.original?.number ?? null)
    if (orig) creditNotes.push({ row: n, note: gstr1CreditNote(s, snap(orig.snapshot)) })
    else orphans.push(n)
  }
  return {
    inPeriod,
    invoices: invoiceRows.map((row) => ({ row, invoice: gstr1Invoice(snap(row.snapshot)) })),
    creditNotes,
    orphans,
    // Table 13 counts every number used, cancelled ones included.
    documents: inPeriod.flatMap((r): Gstr1Document[] =>
      r.number && r.seq !== null
        ? [
            {
              kind: r.kind as Gstr1Document['kind'],
              series: r.seriesId ?? r.kind,
              number: r.number,
              seq: r.seq,
              cancelled: r.status === 'cancelled',
            },
          ]
        : [],
    ),
  }
}

/** One GSTIN's GSTR-1 CSVs for documents issued in [from, to): GSTR-1 is filed per GSTIN. */
export async function gstr1ForPeriod(
  tx: StoreTx,
  from: Date,
  to: Date,
  gstRegistrationId: string | null,
): Promise<Gstr1Export> {
  const inputs = await gstr1Inputs(tx, from, to, gstRegistrationId)
  return buildGstr1(
    inputs.invoices.map((i) => i.invoice),
    inputs.creditNotes.map((n) => n.note),
    inputs.documents,
  )
}
