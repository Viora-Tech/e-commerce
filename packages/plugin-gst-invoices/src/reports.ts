import type { StoreTx } from '@commerce/db'
import {
  buildGstr1,
  DocumentSnapshotSchema,
  type Gstr1Export,
  gstr1CreditNote,
  gstr1Invoice,
} from '@commerce/invoices'
import { and, desc, eq, gte, ilike, inArray, lt, or, type SQL } from 'drizzle-orm'
import { invoice } from './schema'

export type ListFilter = {
  q?: string | undefined
  kind?: 'tax_invoice' | 'credit_note' | 'packing_slip' | 'order_confirmation' | undefined
  /** Inclusive start and exclusive end, as instants. */
  from?: Date | undefined
  to?: Date | undefined
}

function where(filter: ListFilter): SQL | undefined {
  const q = filter.q?.trim()
  return and(
    filter.kind ? eq(invoice.kind, filter.kind) : undefined,
    filter.from ? gte(invoice.issuedAt, filter.from) : undefined,
    filter.to ? lt(invoice.issuedAt, filter.to) : undefined,
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
      issuedAt: invoice.issuedAt,
      snapshot: invoice.snapshot,
    })
    .from(invoice)
    .where(where(filter))
    .orderBy(desc(invoice.issuedAt), desc(invoice.id))
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
    .orderBy(invoice.issuedAt)
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

/**
 * GSTR-1 CSVs for documents issued in [from, to). Credit notes are paired with
 * their invoice even when it was issued in an earlier period.
 */
export async function gstr1ForPeriod(tx: StoreTx, from: Date, to: Date): Promise<Gstr1Export> {
  const inPeriod = await tx
    .select()
    .from(invoice)
    .where(
      and(
        inArray(invoice.kind, ['tax_invoice', 'credit_note']),
        gte(invoice.issuedAt, from),
        lt(invoice.issuedAt, to),
      ),
    )
    .orderBy(invoice.issuedAt)
  const invoices = inPeriod.filter((r) => r.kind === 'tax_invoice')
  const notes = inPeriod.filter((r) => r.kind === 'credit_note')
  const orderIds = [...new Set(notes.map((n) => n.orderId))]
  const originals = orderIds.length
    ? await tx
        .select()
        .from(invoice)
        .where(and(eq(invoice.kind, 'tax_invoice'), inArray(invoice.orderId, orderIds)))
    : []
  const byOrder = new Map(originals.map((o) => [o.orderId, o]))
  const snap = (raw: unknown) => DocumentSnapshotSchema.parse(raw)
  return buildGstr1(
    invoices.map((r) => gstr1Invoice(snap(r.snapshot))),
    notes.flatMap((n) => {
      const orig = byOrder.get(n.orderId)
      return orig ? [gstr1CreditNote(snap(n.snapshot), snap(orig.snapshot))] : []
    }),
  )
}
