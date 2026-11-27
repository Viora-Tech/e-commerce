/**
 * SOURCE OF TRUTH: "Edit invoice" on an issued tax invoice
 * WHAT:  When an issued tax invoice may be corrected in place (`editLockOf`: not cancelled, its
 *        month not marked filed or closed, today on or before that month's GSTR-1 due date, no
 *        IRN, no credit note against it), the save (`editInvoice`: rebuild with the issue
 *        engine, keep the replaced snapshot as a version, note it on the order) and the history.
 * WHY:   Before the return is filed a wrong invoice is corrected, not credited (owner, 28 Nov
 *        2026). The number and date never change; GSTR-1, the PDF and the dashboards read the
 *        invoice row, which always holds the latest version.
 * WHERE: `gstInvoices.getEdit`, `saveEdit` and `getVersionPdf` (packages/api/src/routers/
 *        gst-invoices-edit.ts); the admin's invoice page edit sheet and history card.
 */
import { validateGstin } from '@commerce/core/gstin'
import type { StoreTx } from '@commerce/db'
import {
  type DocumentSnapshot,
  DocumentSnapshotSchema,
  editChanges,
  type InvoiceEdit,
  rebuildDocument,
} from '@commerce/invoices'
import { and, count, desc, eq, ne, sql } from 'drizzle-orm'
import {
  InvoiceError,
  type InvoiceRow,
  regenerateDocument,
  totalsColumns,
  writeLines,
} from './issue'
import { getPeriod, periodOf, periodRange } from './periods'
import { noteOnOrder } from './record-external'
import { invoice, invoiceVersion } from './schema'

const DAY = 86_400_000

/** GSTR-1 for a month is due on the 11th of the next month (monthly filers). */
const DUE_DAY = 11

/** The day (midnight IST) a `YYYY-MM` month's GSTR-1 is due. */
export function gstr1DueDate(period: string): Date {
  return new Date(periodRange(period).to.getTime() + (DUE_DAY - 1) * DAY)
}

export type EditLockReason =
  | 'not_tax_invoice'
  | 'not_issued'
  | 'cancelled'
  | 'external'
  | 'irn'
  | 'filed'
  | 'closed'
  | 'due_passed'
  | 'credited'

export type EditLock = {
  editable: boolean
  /** Why it is locked; null when editable. */
  reason: EditLockReason | null
  /** The invoice's return month, `2026-11`. */
  period: string | null
  /** That month's GSTR-1 due date (ISO); editing is allowed through this whole day. */
  dueDate: string | null
}

type LockRow = Pick<
  InvoiceRow,
  'kind' | 'status' | 'source' | 'reportedPeriod' | 'invoiceDate' | 'issuedAt' | 'snapshot'
>

/** The rule, given what the database says about the invoice's month and credit notes. */
export function editLockOf(
  row: LockRow,
  facts: { filed: boolean; closed: boolean; credited: boolean },
  now: Date,
): EditLock {
  const at = row.invoiceDate ?? row.issuedAt
  const period = periodOf(at)
  const due = gstr1DueDate(period)
  const lock = (reason: EditLockReason | null): EditLock => ({
    editable: reason === null,
    reason,
    period,
    dueDate: due.toISOString(),
  })
  if (row.kind !== 'tax_invoice') return lock('not_tax_invoice')
  if (row.status === 'cancelled') return lock('cancelled')
  if (row.status !== 'issued') return lock('not_issued')
  if (row.source === 'external') return lock('external')
  const einvoice = (row.snapshot as { einvoice?: { irn?: string } | null } | null)?.einvoice
  if (einvoice?.irn) return lock('irn')
  if (row.reportedPeriod || facts.filed) return lock('filed')
  if (facts.closed) return lock('closed')
  if (now.getTime() >= due.getTime() + DAY) return lock('due_passed')
  if (facts.credited) return lock('credited')
  return lock(null)
}

/** A live credit note against this invoice (its `original` is this number). */
async function hasCreditNote(tx: StoreTx, row: InvoiceRow): Promise<boolean> {
  if (!row.number) return false
  const [hit] = await tx
    .select({ id: invoice.id })
    .from(invoice)
    .where(
      and(
        eq(invoice.orderId, row.orderId),
        eq(invoice.kind, 'credit_note'),
        ne(invoice.status, 'cancelled'),
        sql`${invoice.snapshot} -> 'original' ->> 'number' = ${row.number}`,
      ),
    )
    .limit(1)
  return Boolean(hit)
}

/** Whether this invoice may be edited now, read from its month and credit notes. */
export async function invoiceEditLock(
  tx: StoreTx,
  storeId: string,
  row: InvoiceRow,
  now = new Date(),
): Promise<EditLock> {
  const at = row.invoiceDate ?? row.issuedAt
  const month = await getPeriod(tx, storeId, periodOf(at), row.gstRegistrationId)
  return editLockOf(
    row,
    {
      filed: Boolean(month?.gstr1FiledAt),
      closed: Boolean(month?.closedAt),
      credited: await hasCreditNote(tx, row),
    },
    now,
  )
}

const LOCK_MESSAGES: Record<EditLockReason, (period: string) => string> = {
  not_tax_invoice: () => 'Only a tax invoice can be edited',
  not_issued: () => 'A queued invoice is issued from the order as it is',
  cancelled: () => 'This invoice is cancelled',
  external: () => 'This invoice was issued outside Koomerce; correct it there',
  irn: () =>
    'An e-invoice with an IRN cannot be edited; cancel it on the IRP or issue a credit note',
  filed: (p) => `${p} is marked filed; issue a credit note instead`,
  closed: (p) => `${p} is closed; reopen it to edit this invoice`,
  due_passed: (p) => `The GSTR-1 due date for ${p} has passed; issue a credit note instead`,
  credited: () => 'A credit note is issued against this invoice; edit or cancel that first',
}

/** The version history, newest first. */
export async function invoiceVersions(tx: StoreTx, invoiceId: string) {
  const rows = await tx
    .select()
    .from(invoiceVersion)
    .where(eq(invoiceVersion.invoiceId, invoiceId))
    .orderBy(desc(invoiceVersion.version))
  return rows.map((r) => {
    const doc = DocumentSnapshotSchema.parse(r.snapshot)
    return {
      version: r.version,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
      reason: r.reason,
      changes: (r.changes as string[]) ?? [],
      totals: doc.totals,
    }
  })
}

/** One earlier version's snapshot, for its PDF. */
export async function invoiceVersionSnapshot(
  tx: StoreTx,
  invoiceId: string,
  version: number,
): Promise<DocumentSnapshot> {
  const [r] = await tx
    .select({ snapshot: invoiceVersion.snapshot })
    .from(invoiceVersion)
    .where(and(eq(invoiceVersion.invoiceId, invoiceId), eq(invoiceVersion.version, version)))
  if (!r) throw new InvoiceError('not_found', `version ${version} not found`)
  return DocumentSnapshotSchema.parse(r.snapshot)
}

async function editCount(tx: StoreTx, invoiceId: string): Promise<number> {
  const [r] = await tx
    .select({ n: count() })
    .from(invoiceVersion)
    .where(eq(invoiceVersion.invoiceId, invoiceId))
  return r?.n ?? 0
}

/**
 * Save an edit: checked against the lock rule under the row's lock, rebuilt by the issue
 * engine, the replaced snapshot kept as the next version, the PDF marked to render again and
 * the change noted on the order's timeline. The number and date stay.
 */
export async function editInvoice(
  tx: StoreTx,
  storeId: string,
  invoiceId: string,
  input: { edit: InvoiceEdit; reason?: string | null; author: string | null; now?: Date },
) {
  const [row] = await tx.select().from(invoice).where(eq(invoice.id, invoiceId)).for('update')
  if (!row) throw new InvoiceError('not_found', `invoice ${invoiceId} not found`)
  const lock = await invoiceEditLock(tx, storeId, row, input.now)
  if (lock.reason) {
    throw new InvoiceError('locked', LOCK_MESSAGES[lock.reason](lock.period ?? ''))
  }
  const gstin = input.edit.buyer.gstin?.trim() || null
  if (gstin) {
    const check = validateGstin(gstin)
    if (!check.ok) throw new InvoiceError('invalid', check.reason)
  }
  const prior = DocumentSnapshotSchema.parse(row.snapshot)
  const built = rebuildDocument(prior, { ...input.edit, buyer: { ...input.edit.buyer, gstin } })
  if (!built.ok) {
    const why = {
      shape: 'The invoice changed while you edited it; open it again',
      no_goods: 'Keep at least one item on the invoice',
      place: 'Pick the place of supply',
      discount: 'A discount cannot be more than its line',
    }[built.reason]
    throw new InvoiceError('invalid', why)
  }
  const doc = built.doc
  const changes = editChanges(prior, doc)
  if (changes.length === 0) throw new InvoiceError('invalid', 'Nothing changed')
  const version = (await editCount(tx, invoiceId)) + 1
  const reason = input.reason?.trim() || null
  await tx.insert(invoiceVersion).values({
    storeId,
    invoiceId,
    version,
    snapshot: prior,
    changes,
    reason,
    createdBy: input.author,
  })
  const [updated] = await tx
    .update(invoice)
    .set({
      snapshot: doc,
      ...totalsColumns(doc),
      pdfStatus: 'pending',
      pdfError: null,
      updatedAt: new Date(),
    })
    .where(eq(invoice.id, invoiceId))
    .returning()
  await writeLines(tx, storeId, invoiceId, doc)
  const note = `Tax invoice ${row.number ?? ''} edited (edit ${version}): ${changes.join('; ')}.${reason ? ` Reason: ${reason}` : ''}`
  await noteOnOrder(tx, storeId, row.orderId, note.slice(0, 2000), input.author)
  if (!updated) throw new InvoiceError('not_found', `invoice ${invoiceId} not found`)
  return { row: updated, version, changes, before: prior.totals, after: doc.totals }
}

type RegenerateOpts = NonNullable<Parameters<typeof regenerateDocument>[3]>

/**
 * `regenerateDocument` for the order card's GSTIN and the invoice page's export details. An
 * invoice edited by hand is not rebuilt from the order (that would undo the edit): the GSTIN
 * and export details are set on its own snapshot instead.
 */
export async function regenerateKeepingEdits(
  tx: StoreTx,
  storeId: string,
  invoiceId: string,
  opts: RegenerateOpts = {},
): Promise<InvoiceRow> {
  const [row] = await tx.select().from(invoice).where(eq(invoice.id, invoiceId))
  if (row?.status !== 'issued' || (await editCount(tx, invoiceId)) === 0) {
    return regenerateDocument(tx, storeId, invoiceId, opts)
  }
  if (row.reportedPeriod) {
    throw new InvoiceError(
      'locked',
      `${row.number} is reported in GSTR-1 for ${row.reportedPeriod}`,
    )
  }
  const prior = DocumentSnapshotSchema.parse(row.snapshot)
  const doc: DocumentSnapshot = {
    ...prior,
    buyer: {
      ...prior.buyer,
      gstin: opts.buyerGstin === undefined ? prior.buyer.gstin : opts.buyerGstin,
    },
    exportSupply: prior.exportSupply
      ? { ...prior.exportSupply, ...opts.exportDetails }
      : prior.exportSupply,
  }
  const [updated] = await tx
    .update(invoice)
    .set({
      snapshot: doc,
      ...totalsColumns(doc),
      pdfStatus: 'pending',
      pdfError: null,
      updatedAt: new Date(),
    })
    .where(eq(invoice.id, invoiceId))
    .returning()
  if (!updated) throw new InvoiceError('not_found', `invoice ${invoiceId} not found`)
  return updated
}

/** True once the invoice was edited by hand (it has a version). */
export async function wasEdited(tx: StoreTx, invoiceId: string): Promise<boolean> {
  return (await editCount(tx, invoiceId)) > 0
}
