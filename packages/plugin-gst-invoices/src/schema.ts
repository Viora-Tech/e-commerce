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
    kind: text('kind', { enum: ['tax_invoice', 'credit_note'] }).notNull(),
    /** 2025 for FY 2025-26. */
    fyStartYear: integer('fy_start_year').notNull(),
    /** The number the next document takes. */
    next: integer('next').notNull().default(1),
  },
  (t) => [uniqueIndex('invoice_sequence_series').on(t.storeId, t.kind, t.fyStartYear)],
)

export const INVOICE_KINDS = [
  'tax_invoice',
  'credit_note',
  'packing_slip',
  'order_confirmation',
] as const

export const PDF_STATUSES = ['pending', 'ready', 'failed'] as const

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
    /** GST serial; null on packing slips and order confirmations. */
    number: text('number'),
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
    createdAt: at('created_at'),
    updatedAt: at('updated_at'),
  },
  (t) => [
    check(
      'invoice_kind_check',
      sql`${t.kind} in ('tax_invoice', 'credit_note', 'packing_slip', 'order_confirmation')`,
    ),
    check('invoice_pdf_status_check', sql`${t.pdfStatus} in ('pending', 'ready', 'failed')`),
    // Rule 46(b): unique per financial year within a series.
    uniqueIndex('invoice_number_unique')
      .on(t.storeId, t.kind, t.fyStartYear, t.number)
      .where(sql`${t.number} is not null`),
    // Idempotency: one invoice, slip or confirmation per order...
    uniqueIndex('invoice_order_kind_unique')
      .on(t.storeId, t.orderId, t.kind)
      .where(sql`${t.kind} <> 'credit_note'`),
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
