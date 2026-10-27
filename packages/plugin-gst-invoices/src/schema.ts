import { fulfillmentOrder, gstRegistration, newId, order, refund, store } from '@commerce/db'
import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Tables owned by the GST invoices app. They live in the platform's single
 * migration chain (packages/db/drizzle) and every one carries `store_id`, so
 * `apply_store_rls()` isolates them like core tables.
 */

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const at = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow()
/**
 * The GSTIN a document, counter or return month belongs to. GST numbering and returns are per
 * GSTIN, so each registration runs its own series. Null only in a store with no GST
 * registration yet; the first default registration adopts those rows (migration 0082's
 * `adopt_unassigned_gst_documents` trigger).
 */
const gstRegistrationId = () => uuid('gst_registration_id').references(() => gstRegistration.id)

/** One row per store: the app's settings blob, validated by InvoiceSettingsSchema. */
export const invoiceSettings = pgTable(
  'invoice_settings',
  {
    id: id(),
    storeId: storeId(),
    settings: jsonb('settings').notNull().default({}),
    updatedAt: at('updated_at'),
  },
  (t) => [uniqueIndex('invoice_settings_store').on(t.storeId)],
)

/**
 * The running number per GSTIN, series and financial year. Issuing locks the
 * row (`update ... returning`) inside the same transaction that inserts the
 * invoice, so numbers are gapless and never repeat even under concurrency.
 */
export const invoiceSequence = pgTable(
  'invoice_sequence',
  {
    id: id(),
    storeId: storeId(),
    gstRegistrationId: gstRegistrationId(),
    kind: text('kind', {
      enum: ['tax_invoice', 'credit_note', 'receipt_voucher', 'refund_voucher'],
    }).notNull(),
    /** Settings series id; each series counts on its own. */
    seriesId: text('series_id').notNull().default(''),
    /** 2025 for FY 2025-26. */
    fyStartYear: integer('fy_start_year').notNull(),
    /** The number the next document takes. */
    next: integer('next').notNull().default(1),
  },
  (t) => [
    // NULLS NOT DISTINCT: a store without a registration still has one counter per series.
    unique('invoice_sequence_series_fy')
      .on(t.storeId, t.gstRegistrationId, t.seriesId, t.fyStartYear)
      .nullsNotDistinct(),
  ],
)

export const INVOICE_KINDS = [
  'tax_invoice',
  'credit_note',
  'packing_slip',
  'order_confirmation',
  'receipt_voucher',
  'refund_voucher',
] as const

export const PDF_STATUSES = ['pending', 'ready', 'failed'] as const

/**
 * `draft` is a queue entry: an order waiting to be invoiced, with no number.
 * Numbers are assigned only on `issued`. A `cancelled` invoice keeps its
 * number forever (it is reported in GSTR-1 Table 13) and is never reused.
 */
export const INVOICE_STATUSES = ['draft', 'issued', 'cancelled'] as const
/** Domestic GST, or a zero-rated export (under LUT, or with IGST paid). */
export const INVOICE_SUPPLY_TYPES = ['domestic', 'export_lut', 'export_igst'] as const

export const invoice = pgTable(
  'invoice',
  {
    id: id(),
    storeId: storeId(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id),
    /** The refund a credit note reverses. */
    refundId: uuid('refund_id').references(() => refund.id),
    /** The GSTIN that issues it: the order's, or for a credit note its invoice's. */
    gstRegistrationId: gstRegistrationId(),
    /**
     * The parcel a tax invoice bills (or a credit note corrects): an order shipped from two
     * warehouses gets one invoice per parcel, each under its parcel's GSTIN. Null on order-level
     * documents (order confirmation, packing slip, vouchers) and on older documents.
     */
    fulfillmentOrderId: uuid('fulfillment_order_id').references(() => fulfillmentOrder.id),
    kind: text('kind', { enum: INVOICE_KINDS }).notNull(),
    status: text('status', { enum: INVOICE_STATUSES }).notNull().default('issued'),
    /** GST serial; null on packing slips and order confirmations. */
    number: text('number'),
    /** The series the number came from (settings `series[].id`). */
    seriesId: text('series_id'),
    fyStartYear: integer('fy_start_year'),
    seq: integer('seq'),
    /** DocumentSnapshot: everything printed, frozen at issue. */
    snapshot: jsonb('snapshot').notNull(),
    buyerName: text('buyer_name').notNull(),
    buyerGstin: text('buyer_gstin'),
    /** GST numeric state code of the place of supply, e.g. 27. */
    placeOfSupply: text('place_of_supply'),
    /**
     * Export (Markets): `domestic`, or a zero-rated export under the store's LUT (no IGST,
     * the LUT ARN is printed) or with IGST paid. Mirrors `order.tax_regime` at issue.
     */
    supplyType: text('supply_type', { enum: INVOICE_SUPPLY_TYPES }).notNull().default('domestic'),
    /** Export invoices: the buyer's currency and the CBIC rate used for the rupee value (Rule 34). */
    currency: text('currency'),
    exchangeRate: numeric('exchange_rate', { precision: 18, scale: 8 }),
    /** Export invoices: the port and shipping bill (or CSB-V) the goods left under. */
    portCode: text('port_code'),
    shippingBillNo: text('shipping_bill_no'),
    shippingBillDate: date('shipping_bill_date', { mode: 'string' }),
    taxablePaise: integer('taxable_paise').notNull(),
    cgstPaise: integer('cgst_paise').notNull(),
    sgstPaise: integer('sgst_paise').notNull(),
    igstPaise: integer('igst_paise').notNull(),
    totalPaise: integer('total_paise').notNull(),
    /** Private storage key; served only through a signed link or the admin. */
    pdfKey: text('pdf_key'),
    pdfStatus: text('pdf_status', { enum: PDF_STATUSES }).notNull().default('pending'),
    pdfError: text('pdf_error'),
    issuedAt: at('issued_at'),
    /** The date printed on the invoice and used for its period; set when issued. */
    invoiceDate: timestamp('invoice_date', { withTimezone: true }),
    /** When the order became eligible to invoice (paid, or dispatched for pre-orders). */
    eligibleAt: timestamp('eligible_at', { withTimezone: true }),
    /** When the goods left: the default invoice date for goods (time of supply). */
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
    /** `2026-09` once that month's GSTR-1 is marked filed; the invoice can no longer be cancelled. */
    reportedPeriod: text('reported_period'),
    createdAt: at('created_at'),
    updatedAt: at('updated_at'),
  },
  (t) => [
    check(
      'invoice_kind_check',
      sql`${t.kind} in ('tax_invoice', 'credit_note', 'packing_slip', 'order_confirmation', 'receipt_voucher', 'refund_voucher')`,
    ),
    check('invoice_pdf_status_check', sql`${t.pdfStatus} in ('pending', 'ready', 'failed')`),
    check('invoice_status_check', sql`${t.status} in ('draft', 'issued', 'cancelled')`),
    // Rule 46(b): unique per GSTIN per financial year. No registration counts as one GSTIN.
    uniqueIndex('invoice_number_unique')
      .on(
        t.storeId,
        sql`coalesce(${t.gstRegistrationId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        t.fyStartYear,
        t.number,
      )
      .where(sql`${t.number} is not null`),
    // Idempotency: one invoice per parcel, one slip or confirmation per order...
    // A cancelled invoice frees the parcel or order for a fresh one.
    uniqueIndex('invoice_order_kind_live')
      .on(
        t.storeId,
        t.orderId,
        sql`coalesce(${t.fulfillmentOrderId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        t.kind,
      )
      .where(sql`${t.kind} <> 'credit_note' and ${t.status} <> 'cancelled'`),
    // ...and one credit note per refund and parcel (a split order's refund credits each GSTIN).
    uniqueIndex('invoice_refund_unique')
      .on(
        t.storeId,
        t.refundId,
        sql`coalesce(${t.fulfillmentOrderId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      )
      .where(sql`${t.refundId} is not null`),
    index('invoice_store_issued').on(t.storeId, t.issuedAt),
    index('invoice_order').on(t.orderId),
    check(
      'invoice_supply_type_check',
      sql`${t.supplyType} in ('domestic', 'export_lut', 'export_igst')`,
    ),
  ],
)

/** The snapshot's lines as rows, for reports that should not parse jsonb. */
export const invoiceLine = pgTable(
  'invoice_line',
  {
    id: id(),
    storeId: storeId(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoice.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    description: text('description').notNull(),
    sku: text('sku'),
    hsn: text('hsn').notNull(),
    quantity: integer('quantity').notNull(),
    unit: text('unit').notNull(),
    unitPricePaise: integer('unit_price_paise').notNull(),
    discountPaise: integer('discount_paise').notNull(),
    taxablePaise: integer('taxable_paise').notNull(),
    ratePercent: integer('rate_percent').notNull(),
    cgstPaise: integer('cgst_paise').notNull(),
    sgstPaise: integer('sgst_paise').notNull(),
    igstPaise: integer('igst_paise').notNull(),
    totalPaise: integer('total_paise').notNull(),
  },
  (t) => [index('invoice_line_invoice').on(t.invoiceId)],
)

/** A bulk email run from the invoices list: progress for the admin to poll. */
export const invoiceBatch = pgTable('invoice_batch', {
  id: id(),
  storeId: storeId(),
  total: integer('total').notNull(),
  sent: integer('sent').notNull().default(0),
  failed: integer('failed').notNull().default(0),
  /** Last few failures, for the progress toast. */
  errors: jsonb('errors').notNull().default([]),
  createdAt: at('created_at'),
  updatedAt: at('updated_at'),
})

/**
 * A calendar month (IST) of one GSTIN's GST return. Filing marks every
 * invoice of that GSTIN in it reported (no more cancellation); closing stops
 * issuing or backdating into it.
 */
export const invoicePeriod = pgTable(
  'invoice_period',
  {
    id: id(),
    storeId: storeId(),
    gstRegistrationId: gstRegistrationId(),
    /** `2026-09`. */
    period: text('period').notNull(),
    gstr1FiledAt: timestamp('gstr1_filed_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [
    unique('invoice_period_store').on(t.storeId, t.gstRegistrationId, t.period).nullsNotDistinct(),
  ],
)
