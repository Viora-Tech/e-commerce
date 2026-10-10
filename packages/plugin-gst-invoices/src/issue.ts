import { validateGstin } from '@commerce/core/gstin'
import { StoreAddressSchema } from '@commerce/core/store-settings'
import { chargedGstRate, parseStoreTax } from '@commerce/core/tax-settings'
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
  type InvoiceSettings,
  InvoiceSettingsSchema,
  parseInvoiceSettings,
  placeOf,
  type SeriesContext,
} from '@commerce/invoices'
import { and, eq, isNull, ne, sql } from 'drizzle-orm'
import { takeNumber } from './numbers'
import { invoiceParcels, parcelSource } from './parcels'
import { assertPeriodOpen } from './periods'
import { allocateRefund, refundWeights } from './refund-allocation'
import { documentIssuer, type Issuer, orderIssuer, sellerFor } from './registration'
import { invoice, invoiceLine, invoiceSettings } from './schema'

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
  /** The buyer's GSTIN; undefined uses the one the shopper gave at checkout (null prints none). */
  buyerGstin: string | null | undefined,
  /** Shipping bill and currency details already entered on the draft, kept on rebuild. */
  prior?: ExportSupply | null,
  /** The GSTIN issuing it; undefined resolves the order's (see registration.ts). */
  issuer?: Issuer,
  /** The parcel a tax invoice bills (parcels.ts); null or omitted prints the whole order. */
  parcelId?: string | null,
): Promise<DocumentSnapshot> {
  const [o] = await tx.select().from(order).where(eq(order.id, orderId))
  if (!o) throw new InvoiceError('order_not_found', `order ${orderId} not found`)
  const [s] = await tx
    .select({ name: store.name, gstRatePercent: store.gstRatePercent, apps: store.apps })
    .from(store)
    .where(eq(store.id, storeId))
  const storeTax = parseStoreTax(s?.apps)
  const parcel = parcelId ? await parcelSource(tx, storeId, orderId, parcelId) : null
  const allLines = await tx
    .select({
      id: orderLine.id,
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
  // A parcel's invoice prints its own units; a composition GSTIN's carries no GST.
  const lines = parcel
    ? allLines.flatMap((l) => {
        const quantity = parcel.quantities.get(l.id) ?? 0
        return quantity > 0 ? [{ ...l, quantity, rate: parcel.composition ? 0 : l.rate }] : []
      })
    : allLines
  const [ship] = o.shippingAddressId
    ? await tx.select().from(address).where(eq(address.id, o.shippingAddressId))
    : []
  const [cu] = o.customerId
    ? await tx.select().from(customer).where(eq(customer.id, o.customerId))
    : []
  // A business buyer's GSTIN from checkout (Settings → Checkout) bills the business by name.
  const gstin = buyerGstin === undefined ? (o.buyerGstin ?? null) : buyerGstin
  const businessName = gstin && gstin === o.buyerGstin ? o.buyerBusinessName : null
  const buyer = addressParty({
    name: businessName ?? ship?.name ?? cu?.name ?? null,
    line1: ship?.line1 ?? null,
    line2: ship?.line2 ?? null,
    city: ship?.city ?? null,
    state: ship?.stateCode ?? null,
    pincode: ship?.pincode ?? null,
    phone: ship?.phone ?? o.phone,
    email: o.email,
    gstin,
  })
  const cod = o.paymentMethod === 'cod' && !o.checkoutPaidAt
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
  const doc = buildDocument({
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
      shippingPaise: parcel ? parcel.shippingPaise : o.shippingPaise,
      discountPaise: parcel ? parcel.discountPaise : o.discountPaise,
      paymentAdjustmentPaise: parcel ? parcel.paymentAdjustmentPaise : o.paymentAdjustmentPaise,
      paymentAdjustmentLabel: o.paymentAdjustmentLabel,
      totalPaise: parcel ? parcel.totalPaise : o.totalPaise,
      taxBreakdown: parcel ? parcel.taxBreakdown : o.taxBreakdown,
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
    seller: sellerFor(
      settings,
      issuer === undefined
        ? await orderIssuer(tx, orderId, parcel?.parcel.gstRegistrationId)
        : issuer,
      s?.name ?? '',
    ),
    buyer,
    // Billing and delivery are the same address at checkout; ship-to prints only when they differ.
    shipTo: null,
    // Goods delivered to an address: the place of supply is the delivery state.
    placeOfSupply: buyer.state,
    defaultHsn: settings.defaultHsn,
    hsnDigits: settings.hsnDigits,
    fallbackRatePercent: chargedGstRate(s?.gstRatePercent ?? 18, storeTax),
    composition: storeTax.composition || (parcel?.composition ?? false),
  })
  return kind === 'tax_invoice'
    ? { ...doc, advance: await advanceOf(tx, storeId, orderId, parcelId ?? null) }
    : doc
}

/**
 * A pre-order's advance: the issued receipt voucher (rule 50), which the tax
 * invoice at dispatch adjusts against its full value. Null on other orders. With several
 * parcels only one invoice cites it: the first parcel billed under the GSTIN that took the
 * advance, else the first parcel.
 */
async function advanceOf(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  parcelId: string | null,
): Promise<DocumentSnapshot['advance']> {
  const rv = await existing(tx, orderId, 'receipt_voucher')
  if (rv?.status !== 'issued' || !rv.number) return null
  if (parcelId) {
    const parcels = await invoiceParcels(tx, storeId, orderId)
    const cites =
      parcels.find((p) => p.gstRegistrationId === rv.gstRegistrationId) ?? parcels[0] ?? null
    if (cites?.id !== parcelId) return null
  }
  return { number: rv.number, issuedAt: rv.issuedAt.toISOString(), amountPaise: rv.totalPaise }
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
    /** The issuing GSTIN; null in a store without a registration. */
    gstRegistrationId: string | null
    /** The parcel a tax invoice bills; null for order-level documents. */
    fulfillmentOrderId?: string | null
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
      gstRegistrationId: extra.gstRegistrationId,
      fulfillmentOrderId: extra.fulfillmentOrderId ?? null,
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

/**
 * The order's live (draft or issued, never cancelled) document of a kind. Order-level kinds
 * take no parcel; a tax invoice is per parcel (`fulfillmentOrderId`), and without one this
 * finds the order's first live invoice, whichever parcel it bills.
 */
export async function existing(
  tx: StoreTx,
  orderId: string,
  kind: DocumentKind,
  fulfillmentOrderId?: string | null,
) {
  const [row] = await tx
    .select()
    .from(invoice)
    .where(
      and(
        eq(invoice.orderId, orderId),
        eq(invoice.kind, kind),
        ne(invoice.status, 'cancelled'),
        fulfillmentOrderId === undefined
          ? undefined
          : sameParcel(invoice.fulfillmentOrderId, fulfillmentOrderId),
      ),
    )
    .orderBy(invoice.createdAt, invoice.id)
    .limit(1)
  return row ?? null
}

/** Every live document of a kind for the order: one tax invoice per parcel. */
export async function liveDocuments(tx: StoreTx, orderId: string, kind: DocumentKind) {
  return tx
    .select()
    .from(invoice)
    .where(
      and(eq(invoice.orderId, orderId), eq(invoice.kind, kind), ne(invoice.status, 'cancelled')),
    )
    .orderBy(invoice.createdAt, invoice.id)
}

const sameParcel = (column: typeof invoice.fulfillmentOrderId, id: string | null) =>
  id ? eq(column, id) : isNull(column)

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
  const issuer = await orderIssuer(tx, orderId)
  const doc = await orderSnapshot(
    tx,
    storeId,
    orderId,
    kind,
    null,
    at,
    settings,
    opts.buyerGstin,
    null,
    issuer,
  )
  const row = await insertDocument(tx, storeId, doc, { gstRegistrationId: issuer?.id ?? null })
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
  // A queued draft follows the order's GSTIN as it is now; an issued document keeps its own.
  const issuer =
    row.status === 'draft'
      ? await orderIssuer(tx, row.orderId, row.gstRegistrationId)
      : await documentIssuer(tx, row.gstRegistrationId)
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
      issuer,
      row.fulfillmentOrderId,
    )
  }
  const [updated] = await tx
    .update(invoice)
    .set({
      snapshot: doc,
      gstRegistrationId: row.status === 'draft' ? (issuer?.id ?? null) : row.gstRegistrationId,
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

  // How much of the refund each invoice takes: all of it with one invoice (capped by the note).
  let amounts: Map<string, number>
  if (invoices.length === 1) {
    amounts = new Map([[invoices[0]?.id as string, r.amountPaise]])
  } else {
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
    const weights = await refundWeights(tx, r.orderId, refundId)
    amounts = allocateRefund(
      r.amountPaise,
      invoices.map((inv) => ({
        key: inv.id,
        capacityPaise:
          inv.totalPaise -
          credited
            .filter((c) => c.fulfillmentOrderId === inv.fulfillmentOrderId)
            .reduce((n, c) => n + c.totalPaise, 0),
        weight: inv.fulfillmentOrderId ? (weights.get(inv.fulfillmentOrderId) ?? 0) : 0,
      })),
    )
  }

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

export async function getDocument(tx: StoreTx, invoiceId: string): Promise<InvoiceRow | null> {
  const [row] = await tx.select().from(invoice).where(eq(invoice.id, invoiceId))
  return row ?? null
}

export async function documentsForOrder(tx: StoreTx, orderId: string): Promise<InvoiceRow[]> {
  return tx.select().from(invoice).where(eq(invoice.orderId, orderId)).orderBy(invoice.issuedAt)
}
