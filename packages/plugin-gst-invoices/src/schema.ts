import { newId, order, refund, store } from '@commerce/db'
import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
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
 * The running number per store, series and financial year. Issuing locks the
 * row (`update ... returning`) inside the same transaction that inserts the
 * invoice, so numbers are gapless and never repeat even under concurrency.
 */
export const invoiceSequence = pgTable(
  'invoice_sequence',
  {
    id: id(),
    storeId: storeId(),
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
  (t) => [uniqueIndex('invoice_sequence_series_fy').on(t.storeId, t.seriesId, t.fyStartYear)],
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
    // Rule 46(b): unique per financial year within a series.
    uniqueIndex('invoice_number_unique')
      .on(t.storeId, t.fyStartYear, t.number)
      .where(sql`${t.number} is not null`),
    // Idempotency: one invoice, slip or confirmation per order...
    // A cancelled invoice frees the order for a fresh one.
    uniqueIndex('invoice_order_kind_live')
      .on(t.storeId, t.orderId, t.kind)
      .where(sql`${t.kind} <> 'credit_note' and ${t.status} <> 'cancelled'`),
    // ...and one credit note per refund.
    uniqueIndex('invoice_refund_unique')
      .on(t.storeId, t.refundId)
      .where(sql`${t.refundId} is not null`),
    index('invoice_store_issued').on(t.storeId, t.issuedAt),
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
 * A calendar month (IST) of the store's GST return. Filing marks every
 * invoice in it reported (no more cancellation); closing stops issuing or
 * backdating into it.
 */
export const invoicePeriod = pgTable(
  'invoice_period',
  {
    id: id(),
    storeId: storeId(),
    /** `2026-09`. */
    period: text('period').notNull(),
    gstr1FiledAt: timestamp('gstr1_filed_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('invoice_period_store').on(t.storeId, t.period)],
)
