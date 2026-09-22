import { validateGstin } from '@commerce/core/gstin'
import { StoreAddressSchema } from '@commerce/core/store-settings'
import {
  address,
  customer,
  order,
  orderLine,
  refund,
  type StoreTx,
  store,
  variant,
} from '@commerce/db'
import {
  addressParty,
  buildCreditNote,
  buildDocument,
  type DocumentKind,
  type DocumentSnapshot,
  DocumentSnapshotSchema,
  defaultInvoiceSettings,
  EXPORT_ENDORSEMENTS,
  type ExportSupply,
  financialYear,
  formatSeriesNumber,
  type InvoiceSettings,
  InvoiceSettingsSchema,
  type NumberedKind,
  parseInvoiceSettings,
  pickSeries,
  placeOf,
  type SeriesContext,
  sellerParty,
} from '@commerce/invoices'
import { and, eq, ne, sql } from 'drizzle-orm'
import { assertPeriodOpen } from './periods'
import { invoice, invoiceLine, invoiceSequence, invoiceSettings } from './schema'

export type InvoiceRow = typeof invoice.$inferSelect

/** A stored row whose kind the caller did not expect, or an order the store cannot see. */
export class InvoiceError extends Error {
  constructor(
    readonly code:
      | 'order_not_found'
      | 'no_invoice'
      | 'disabled'
      | 'not_found'
      | 'invalid'
      | 'locked'
      | 'closed'
      | 'backdated'
      | 'expired',
    message: string,
  ) {
    super(message)
  }
}

/**
 * The app's settings. Before the merchant saves anything, the seller block is
 * prefilled from Settings › General so the first invoice is already correct.
 */
export async function loadSettings(tx: StoreTx, storeId: string): Promise<InvoiceSettings> {
  const [row] = await tx
    .select({ settings: invoiceSettings.settings })
    .from(invoiceSettings)
    .where(eq(invoiceSettings.storeId, storeId))
  if (row) return parseInvoiceSettings(row.settings)
  const [s] = await tx.select().from(store).where(eq(store.id, storeId))
  if (!s) return defaultInvoiceSettings
  const a = StoreAddressSchema.safeParse(s.address ?? {})
  const place = placeOf(a.success ? a.data.state : null)
  return parseInvoiceSettings({
    seller: {
      legalName: s.name,
      // A GSTIN that fails its checksum is left for the merchant to fix here.
      gstin: s.gstin && validateGstin(s.gstin).ok ? s.gstin : '',
      stateCode: place?.code ?? '',
      line1: a.success ? a.data.line1 : '',
      line2: a.success ? a.data.line2 : '',
      city: a.success ? a.data.city : '',
      pincode: a.success ? a.data.pincode : '',
      email: s.contactEmail ?? '',
      phone: s.contactPhone ?? '',
    },
  })
}

export async function saveSettings(
  tx: StoreTx,
  storeId: string,
  input: unknown,
): Promise<InvoiceSettings> {
  const settings = InvoiceSettingsSchema.parse(input)
  await tx
    .insert(invoiceSettings)
    .values({ storeId, settings })
    .onConflictDoUpdate({
      target: invoiceSettings.storeId,
      set: { settings, updatedAt: new Date() },
    })
  return settings
}

/**
 * Take the next number in a series. The upsert locks the sequence row until
 * the surrounding transaction ends, so a concurrent issuer waits and then
 * gets the following number; a rollback returns the number unused. Numbers
 * therefore never repeat and never skip (rule 46(b)).
 */
export async function takeNumber(
  tx: StoreTx,
  storeId: string,
  kind: NumberedKind,
  at: Date,
  settings: InvoiceSettings,
  ctx: SeriesContext,
): Promise<{ number: string; seq: number; fyStartYear: number; seriesId: string }> {
  const series = pickSeries(settings.series, kind, ctx)
  if (!series)
    throw new InvoiceError('invalid', `No ${kind.replace('_', ' ')} series matches this order`)
  const fy = financialYear(at)
  const [row] = await tx
    .insert(invoiceSequence)
    .values({ storeId, kind, seriesId: series.id, fyStartYear: fy.startYear, next: 2 })
    .onConflictDoUpdate({
      target: [invoiceSequence.storeId, invoiceSequence.seriesId, invoiceSequence.fyStartYear],
      set: { next: sql`${invoiceSequence.next} + 1` },
    })
    .returning({ next: invoiceSequence.next })
  if (!row) throw new Error('sequence upsert returned nothing')
  const seq = row.next - 1
  return {
    number: formatSeriesNumber(series, fy, seq),
    seq,
    fyStartYear: fy.startYear,
    seriesId: series.id,
  }
}

/** Which series rule a document falls under. */
export const seriesContextOf = (doc: DocumentSnapshot): SeriesContext => ({
  export: doc.exportSupply !== null,
  b2b: Boolean(doc.buyer.gstin),
})

/** Everything about an order a document prints, read inside the store's RLS scope. */
export async function orderSnapshot(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  kind: DocumentKind,
  number: string | null,
  issuedAt: Date,
  settings: InvoiceSettings,
  buyerGstin: string | null,
  /** Shipping bill and currency details already entered on the draft, kept on rebuild. */
  prior?: ExportSupply | null,
): Promise<DocumentSnapshot> {
  const [o] = await tx.select().from(order).where(eq(order.id, orderId))
  if (!o) throw new InvoiceError('order_not_found', `order ${orderId} not found`)
  const [s] = await tx
    .select({ name: store.name, gstRatePercent: store.gstRatePercent })
    .from(store)
    .where(eq(store.id, storeId))
  const lines = await tx
    .select({
      title: orderLine.title,
      variantTitle: orderLine.variantTitle,
      quantity: orderLine.quantity,
      unitPricePaise: orderLine.unitPricePaise,
      rate: orderLine.gstRatePercent,
      lineHsn: orderLine.hsCode,
      sku: variant.sku,
      variantHsn: variant.hsCode,
    })
    .from(orderLine)
    .leftJoin(variant, eq(variant.id, orderLine.variantId))
    .where(eq(orderLine.orderId, orderId))
    .orderBy(orderLine.id)
  const [ship] = o.shippingAddressId
    ? await tx.select().from(address).where(eq(address.id, o.shippingAddressId))
    : []
  const [cu] = o.customerId
    ? await tx.select().from(customer).where(eq(customer.id, o.customerId))
    : []
  const buyer = addressParty({
    name: ship?.name ?? cu?.name ?? null,
    line1: ship?.line1 ?? null,
    line2: ship?.line2 ?? null,
    city: ship?.city ?? null,
    state: ship?.stateCode ?? null,
    pincode: ship?.pincode ?? null,
    phone: ship?.phone ?? o.phone,
    email: o.email,
    gstin: buyerGstin,
  })
  const cod = o.paymentMethod === 'cod' && o.status !== 'paid'
  const country = (ship?.country ?? 'IN').toUpperCase()
  const exportSupply: ExportSupply | null =
    country === 'IN'
      ? null
      : {
          mode: settings.exportMode,
          country,
          countryName: countryName(country),
          lutNumber: settings.exportMode === 'lut' ? settings.lutNumber || null : null,
          endorsement: EXPORT_ENDORSEMENTS[settings.exportMode],
          portCode: prior?.portCode ?? null,
          shippingBillNumber: prior?.shippingBillNumber ?? null,
          shippingBillDate: prior?.shippingBillDate ?? null,
          currency: prior?.currency ?? null,
          exchangeRate: prior?.exchangeRate ?? null,
        }
  return buildDocument({
    exportSupply,
    kind,
    number,
    issuedAt,
    order: {
      id: o.id,
      number: o.number,
      placedAt: o.placedAt,
      paymentMethod: paymentLabel(o.paymentMethod),
      collectPaise: kind === 'packing_slip' && cod ? o.totalPaise : 0,
      shippingPaise: o.shippingPaise,
      discountPaise: o.discountPaise,
      paymentAdjustmentPaise: o.paymentAdjustmentPaise,
      paymentAdjustmentLabel: o.paymentAdjustmentLabel,
      totalPaise: o.totalPaise,
      taxBreakdown: o.taxBreakdown,
    },
    lines: lines.map((l) => ({
      title: l.title,
      variantTitle: l.variantTitle,
      sku: l.sku,
      quantity: l.quantity,
      unitPricePaise: l.unitPricePaise,
      hsn: l.lineHsn ?? l.variantHsn,
      ratePercent: l.rate,
    })),
    seller: sellerParty(settings.seller, s?.name ?? ''),
    buyer,
    // Billing and delivery are the same address at checkout; ship-to prints only when they differ.
    shipTo: null,
    // Goods delivered to an address: the place of supply is the delivery state.
    placeOfSupply: buyer.state,
    defaultHsn: settings.defaultHsn,
    hsnDigits: settings.hsnDigits,
    fallbackRatePercent: s?.gstRatePercent ?? 18,
  })
}

const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

const PAYMENT_LABELS: Record<string, string> = {
  cod: 'Cash on delivery',
  manual: 'UPI or bank transfer',
  razorpay: 'Razorpay',
}
const paymentLabel = (id: string | null) => (id ? (PAYMENT_LABELS[id] ?? id) : null)

export async function insertDocument(
  tx: StoreTx,
  storeId: string,
  doc: DocumentSnapshot,
  extra: {
    refundId?: string | null
    seq?: number | null
    fyStartYear?: number | null
    status?: InvoiceRow['status']
    seriesId?: string | null
    invoiceDate?: Date | null
    eligibleAt?: Date | null
    dispatchedAt?: Date | null
  },
): Promise<InvoiceRow | null> {
  const [row] = await tx
    .insert(invoice)
    .values({
      storeId,
      orderId: doc.order.id,
      refundId: extra.refundId ?? null,
      kind: doc.kind,
      number: doc.number,
      seq: extra.seq ?? null,
      fyStartYear: extra.fyStartYear ?? null,
      seriesId: extra.seriesId ?? null,
      status: extra.status ?? 'issued',
      invoiceDate: extra.invoiceDate ?? (extra.status === 'draft' ? null : new Date(doc.issuedAt)),
      eligibleAt: extra.eligibleAt ?? null,
      dispatchedAt: extra.dispatchedAt ?? null,
      snapshot: doc,
      ...totalsColumns(doc),
      issuedAt: new Date(doc.issuedAt),
    })
    .onConflictDoNothing()
    .returning()
  if (!row) return null
  await writeLines(tx, storeId, row.id, doc)
  return row
}

export function totalsColumns(doc: DocumentSnapshot) {
  return {
    buyerName: doc.buyer.name,
    buyerGstin: doc.buyer.gstin,
    placeOfSupply: doc.placeOfSupply?.gstCode ?? null,
    taxablePaise: doc.totals.taxablePaise,
    cgstPaise: doc.totals.cgstPaise,
    sgstPaise: doc.totals.sgstPaise,
    igstPaise: doc.totals.igstPaise,
    totalPaise: doc.totals.totalPaise,
  }
}

export async function writeLines(
  tx: StoreTx,
  storeId: string,
  invoiceId: string,
  doc: DocumentSnapshot,
) {
  await tx.delete(invoiceLine).where(eq(invoiceLine.invoiceId, invoiceId))
  if (doc.lines.length === 0) return
  await tx.insert(invoiceLine).values(
    doc.lines.map((l, position) => ({
      storeId,
      invoiceId,
      position,
      description: l.description,
      sku: l.sku,
      hsn: l.hsn,
      quantity: l.quantity,
      unit: l.unit,
      unitPricePaise: l.unitPricePaise,
      discountPaise: l.discountPaise,
      taxablePaise: l.taxablePaise,
      ratePercent: l.ratePercent,
      cgstPaise: l.cgstPaise,
      sgstPaise: l.sgstPaise,
      igstPaise: l.igstPaise,
      totalPaise: l.totalPaise,
    })),
  )
}

/** The order's live (draft or issued, never cancelled) document of a kind. */
export async function existing(tx: StoreTx, orderId: string, kind: DocumentKind) {
  const [row] = await tx
    .select()
    .from(invoice)
    .where(
      and(eq(invoice.orderId, orderId), eq(invoice.kind, kind), ne(invoice.status, 'cancelled')),
    )
  return row ?? null
}

/**
 * Issue an order's packing slip or order confirmation, or return the one
 * already issued: idempotent on (order, kind). These carry no GST number, so
 * they skip the invoice queue. Tax invoices go through `queue.ts`.
 */
export async function issueDocument(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  kind: 'packing_slip' | 'order_confirmation',
  opts: { at?: Date; buyerGstin?: string | null } = {},
): Promise<{ row: InvoiceRow; created: boolean }> {
  const prior = await existing(tx, orderId, kind)
  if (prior) return { row: prior, created: false }
  const settings = await loadSettings(tx, storeId)
  if (!settings.documents[kind].enabled) {
    throw new InvoiceError('disabled', `${kind} is switched off in the GST invoices settings`)
  }
  // Serialise issuers of this order so the loser never takes a number it cannot use.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`gst-invoices:${orderId}:${kind}`}))`,
  )
  const again = await existing(tx, orderId, kind)
  if (again) return { row: again, created: false }
  const at = opts.at ?? new Date()
  const doc = await orderSnapshot(
    tx,
    storeId,
    orderId,
    kind,
    null,
    at,
    settings,
    opts.buyerGstin ?? null,
  )
  const row = await insertDocument(tx, storeId, doc, {})
  if (!row) throw new Error('invoice insert raced past the advisory lock')
  return { row, created: true }
}

/**
 * Rebuild a document from the order as it stands now (a corrected address, a
 * buyer GSTIN added on request) keeping its number and date. The PDF is
 * marked stale so it renders again.
 */
export async function regenerateDocument(
  tx: StoreTx,
  storeId: string,
  invoiceId: string,
  opts: {
    buyerGstin?: string | null | undefined
    /** Shipping bill, port and currency for an export invoice. */
    exportDetails?:
      | Partial<
          Pick<
            ExportSupply,
            'portCode' | 'shippingBillNumber' | 'shippingBillDate' | 'currency' | 'exchangeRate'
          >
        >
      | undefined
  } = {},
): Promise<InvoiceRow> {
  const [row] = await tx.select().from(invoice).where(eq(invoice.id, invoiceId))
  if (!row) throw new InvoiceError('not_found', `invoice ${invoiceId} not found`)
  if (row.status === 'cancelled' || row.reportedPeriod) {
    throw new InvoiceError(
      'locked',
      row.reportedPeriod
        ? `${row.number} is reported in GSTR-1 for ${row.reportedPeriod}; issue a credit note instead`
        : `${row.number} is cancelled`,
    )
  }
  const prior = DocumentSnapshotSchema.parse(row.snapshot)
  const settings = await loadSettings(tx, storeId)
  let doc: DocumentSnapshot
  if (row.kind === 'credit_note') {
    // A credit note mirrors its invoice; only the buyer block can change.
    doc = { ...prior, buyer: { ...prior.buyer, gstin: opts.buyerGstin ?? prior.buyer.gstin } }
  } else {
    doc = await orderSnapshot(
      tx,
      storeId,
      row.orderId,
      row.kind,
      row.number,
      row.invoiceDate ?? row.issuedAt,
      settings,
      opts.buyerGstin === undefined ? prior.buyer.gstin : opts.buyerGstin,
      prior.exportSupply ? { ...prior.exportSupply, ...opts.exportDetails } : null,
    )
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
  await writeLines(tx, storeId, invoiceId, doc)
  if (!updated) throw new InvoiceError('not_found', `invoice ${invoiceId} not found`)
  return updated
}

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
 * The credit note for a refund (rule 53(1A)), idempotent on the refund. Null
 * when the order has no tax invoice: nothing was invoiced, so nothing to credit.
 */
export async function issueCreditNote(
  tx: StoreTx,
  storeId: string,
  refundId: string,
  opts: { at?: Date } = {},
): Promise<{ row: InvoiceRow; created: boolean } | null> {
  const [prior] = await tx.select().from(invoice).where(eq(invoice.refundId, refundId))
  if (prior) return { row: prior, created: false }
  const [r] = await tx.select().from(refund).where(eq(refund.id, refundId))
  if (!r || r.status === 'failed') return null
  const original = await existing(tx, r.orderId, 'tax_invoice')
  if (original?.status !== 'issued') return null
  const settings = await loadSettings(tx, storeId)
  if (!settings.documents.credit_note.enabled) return null
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`gst-invoices:refund:${refundId}`}))`,
  )
  const [again] = await tx.select().from(invoice).where(eq(invoice.refundId, refundId))
  if (again) return { row: again, created: false }
  const at = opts.at ?? new Date()
  await assertPeriodOpen(tx, storeId, at)
  const cutoff = creditNoteCutoff(original.invoiceDate ?? original.issuedAt, settings.gstr9FiledOn)
  if (at.getTime() > cutoff.getTime()) {
    throw new InvoiceError(
      'expired',
      `Credit notes for ${original.number} were allowed until ${cutoff.toISOString().slice(0, 10)} (section 34(2)). Refund without a credit note and keep the record.`,
    )
  }
  const invoiceDoc = DocumentSnapshotSchema.parse(original.snapshot)
  const n = await takeNumber(tx, storeId, 'credit_note', at, settings, seriesContextOf(invoiceDoc))
  const doc = buildCreditNote({
    invoice: invoiceDoc,
    number: n.number,
    issuedAt: at,
    amountPaise: r.amountPaise,
    reason: r.reason,
  })
  const row = await insertDocument(tx, storeId, doc, {
    refundId,
    seq: n.seq,
    fyStartYear: n.fyStartYear,
    seriesId: n.seriesId,
  })
  if (!row) throw new Error('credit note insert raced past the advisory lock')
  return { row, created: true }
}

export async function getDocument(tx: StoreTx, invoiceId: string): Promise<InvoiceRow | null> {
  const [row] = await tx.select().from(invoice).where(eq(invoice.id, invoiceId))
  return row ?? null
}

export async function documentsForOrder(tx: StoreTx, orderId: string): Promise<InvoiceRow[]> {
  return tx.select().from(invoice).where(eq(invoice.orderId, orderId)).orderBy(invoice.issuedAt)
}
