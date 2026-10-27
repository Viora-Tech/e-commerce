import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { location, newId, store, variant } from './schema'

/*
 * Purchasing: suppliers, purchase orders and their lines, inbound shipments (one Bill of
 * Entry or container that can carry several purchase orders), the charges that make up
 * landed cost (freight, customs, clearing, bank) and how each is split across lines, and
 * the receipts that book stock at landed cost into the variant's weighted average cost.
 * The maths lives in `packages/core/src/inventory/landed-cost.ts`.
 */

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
/** INR per one unit of the foreign currency, six decimals (83.125000). 1 for INR. */
const fxRate = () => numeric('fx_rate', { precision: 18, scale: 6 }).notNull().default('1')
const oneOf = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '))

export const INBOUND_SHIPMENT_STATUS_VALUES = [
  'in_transit',
  'at_port',
  'cleared',
  'delivered',
] as const
export const PURCHASE_CHARGE_KIND_VALUES = [
  'goods_adjustment',
  'freight_insurance',
  'customs_bcd',
  'customs_sws',
  'customs_igst',
  'cha_fee',
  'port_handling',
  'freight_local',
  'bank_fx',
  'other',
] as const
export const SPLIT_METHOD_VALUES = [
  'by_weight',
  'by_value',
  'by_quantity',
  'specific_lines',
  'manual',
] as const

/** Someone the store buys stock from. Purchase orders copy the name, email and phone. */
export const supplier = pgTable(
  'supplier',
  {
    id: id(),
    storeId: storeId(),
    name: text('name').notNull(),
    gstin: text('gstin'),
    /** ISO 3166 alpha-2. */
    country: text('country').notNull().default('IN'),
    /** What the supplier bills in; a new purchase order starts in it. */
    currency: text('currency').notNull().default('INR'),
    email: text('email'),
    phone: text('phone'),
    address: text('address'),
    paymentTerms: text('payment_terms'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('supplier_store_name').on(t.storeId, t.name)],
)

/**
 * One import consignment: a Bill of Entry, a container, an air waybill. It can carry
 * several purchase orders (and suppliers); its charges split across all their lines.
 */
export const inboundShipment = pgTable(
  'inbound_shipment',
  {
    id: id(),
    storeId: storeId(),
    number: integer('number').notNull(),
    /** The merchant's own reference: container, AWB or forwarder job number. */
    reference: text('reference'),
    billOfEntryNo: text('bill_of_entry_no'),
    billOfEntryDate: date('bill_of_entry_date'),
    port: text('port'),
    /** Who carries it (`fedex`, `dhl`, …, or free text) and their tracking number and page. */
    carrier: text('carrier'),
    trackingNumber: text('tracking_number'),
    trackingUrl: text('tracking_url'),
    /** When it should arrive: typed, or the carrier's date read from tracking. */
    expectedAt: date('expected_at'),
    /** Last time the carrier's tracking was read for `expectedAt`; null when typed. */
    trackedAt: timestamp('tracked_at', { withTimezone: true }),
    arrivedAt: timestamp('arrived_at', { withTimezone: true }),
    status: text('status', { enum: INBOUND_SHIPMENT_STATUS_VALUES })
      .notNull()
      .default('in_transit'),
    note: text('note'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('inbound_shipment_store_number').on(t.storeId, t.number),
    check(
      'inbound_shipment_status_check',
      sql`${t.status} in (${oneOf(INBOUND_SHIPMENT_STATUS_VALUES)})`,
    ),
  ],
)

/** Stock ordered from a supplier into one location; receiving turns incoming into on_hand. */
export const purchaseOrder = pgTable(
  'purchase_order',
  {
    id: id(),
    storeId: storeId(),
    number: integer('number').notNull(),
    /** The merchant's own name for the order ("Diwali restock"); the number stays. */
    name: text('name'),
    /** Null on orders typed before suppliers existed; the name fields below are always set. */
    supplierId: uuid('supplier_id').references(() => supplier.id, { onDelete: 'set null' }),
    supplierName: text('supplier_name').notNull(),
    supplierEmail: text('supplier_email'),
    supplierPhone: text('supplier_phone'),
    locationId: uuid('location_id')
      .notNull()
      .references(() => location.id),
    inboundShipmentId: uuid('inbound_shipment_id').references(() => inboundShipment.id, {
      onDelete: 'set null',
    }),
    status: text('status', {
      enum: ['draft', 'ordered', 'partially_received', 'received', 'closed', 'cancelled'],
    })
      .notNull()
      .default('draft'),
    expectedAt: timestamp('expected_at', { withTimezone: true }),
    /** The supplier's currency; line prices are in its minor units. */
    currency: text('currency').notNull().default('INR'),
    fxRate: fxRate(),
    /** Legacy: moved into purchase_charge by migration 0094 and no longer written. */
    shippingPaise: integer('shipping_paise').notNull().default(0),
    /** Legacy: moved into purchase_charge by migration 0094 and no longer written. */
    taxPaise: integer('tax_paise').notNull().default(0),
    note: text('note'),
    orderedAt: timestamp('ordered_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('purchase_order_store_number').on(t.storeId, t.number),
    index('purchase_order_store_shipment').on(t.storeId, t.inboundShipmentId),
    index('purchase_order_store_supplier').on(t.storeId, t.supplierId),
  ],
)

export const purchaseOrderLine = pgTable(
  'purchase_order_line',
  {
    id: id(),
    storeId: storeId(),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrder.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => variant.id),
    quantity: integer('quantity').notNull(),
    /** Accepted units: on hand at the destination. */
    received: integer('received').notNull().default(0),
    /** Units that arrived but were refused (damaged, wrong item). Never stocked. */
    rejected: integer('rejected').notNull().default(0),
    /** Supplier's price per unit in the order's currency, minor units (cents, paise). */
    unitPriceMinor: integer('unit_price_minor').notNull().default(0),
    /** Goods cost per unit in paise (price × FX rate), kept in step by recosting. */
    unitCostPaise: integer('unit_cost_paise').notNull().default(0),
    hsnCode: text('hsn_code'),
    /** Goods plus this line's share of non-recoverable charges, per unit. Null before costing. */
    landedUnitCostPaise: integer('landed_unit_cost_paise'),
    /** Units received through landed costing (receipts before 0094 are not). */
    costedUnits: integer('costed_units').notNull().default(0),
    /** Paise those units added to inventory value; revaluation moves it to the new cost. */
    bookedCostPaise: bigint('booked_cost_paise', { mode: 'number' }).notNull().default(0),
  },
  (t) => [index('purchase_order_line_order').on(t.purchaseOrderId)],
)

export type ManualSplit = { lineId: string; amountPaise: number }

/**
 * A cost on a purchase order or an inbound shipment (exactly one of the two, enforced by the
 * service; the check only demands an owner). Amount is ex-GST in its own currency; the GST
 * on a service bill is input credit and never product cost. `recoverable` amounts (IGST paid
 * at customs) are tracked and split but stay out of landed cost too.
 */
export const purchaseCharge = pgTable(
  'purchase_charge',
  {
    id: id(),
    storeId: storeId(),
    purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrder.id, {
      onDelete: 'cascade',
    }),
    inboundShipmentId: uuid('inbound_shipment_id').references(() => inboundShipment.id, {
      onDelete: 'cascade',
    }),
    kind: text('kind', { enum: PURCHASE_CHARGE_KIND_VALUES }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: text('currency').notNull().default('INR'),
    fxRate: fxRate(),
    gstPaise: bigint('gst_paise', { mode: 'number' }).notNull().default(0),
    recoverable: boolean('recoverable').notNull().default(false),
    splitMethod: text('split_method', { enum: SPLIT_METHOD_VALUES }).notNull(),
    /** `specific_lines`: the lines that carry it (split by value among them). */
    splitLineIds: jsonb('split_line_ids').$type<string[]>(),
    /** `manual`: paise per line, summing to the charge in paise. */
    manualSplits: jsonb('manual_splits').$type<ManualSplit[]>(),
    payee: text('payee'),
    note: text('note'),
    incurredAt: date('incurred_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('purchase_charge_store_order').on(t.storeId, t.purchaseOrderId),
    index('purchase_charge_store_shipment').on(t.storeId, t.inboundShipmentId),
    check('purchase_charge_kind_check', sql`${t.kind} in (${oneOf(PURCHASE_CHARGE_KIND_VALUES)})`),
    check(
      'purchase_charge_split_method_check',
      sql`${t.splitMethod} in (${oneOf(SPLIT_METHOD_VALUES)})`,
    ),
    check(
      'purchase_charge_owner_check',
      sql`num_nonnulls(${t.purchaseOrderId}, ${t.inboundShipmentId}) >= 1`,
    ),
  ],
)

/** One charge's share on one line, in paise. A charge's splits sum to it exactly. */
export const purchaseChargeSplit = pgTable(
  'purchase_charge_split',
  {
    id: id(),
    storeId: storeId(),
    chargeId: uuid('charge_id')
      .notNull()
      .references(() => purchaseCharge.id, { onDelete: 'cascade' }),
    purchaseOrderLineId: uuid('purchase_order_line_id')
      .notNull()
      .references(() => purchaseOrderLine.id, { onDelete: 'cascade' }),
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull(),
  },
  (t) => [
    index('purchase_charge_split_charge').on(t.chargeId),
    index('purchase_charge_split_line').on(t.purchaseOrderLineId),
  ],
)

/** One delivery checked in against a purchase order. */
export const purchaseOrderReceipt = pgTable(
  'purchase_order_receipt',
  {
    id: id(),
    storeId: storeId(),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrder.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => location.id),
    /** Better Auth user id of the member who received it. */
    receivedBy: text('received_by'),
    note: text('note'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('purchase_order_receipt_order').on(t.storeId, t.purchaseOrderId)],
)

/** Accepted and rejected units of one line in a receipt, and what the cost became. */
export const purchaseOrderReceiptLine = pgTable(
  'purchase_order_receipt_line',
  {
    id: id(),
    storeId: storeId(),
    receiptId: uuid('receipt_id')
      .notNull()
      .references(() => purchaseOrderReceipt.id, { onDelete: 'cascade' }),
    purchaseOrderLineId: uuid('purchase_order_line_id')
      .notNull()
      .references(() => purchaseOrderLine.id, { onDelete: 'cascade' }),
    accepted: integer('accepted').notNull().default(0),
    rejected: integer('rejected').notNull().default(0),
    /** Landed cost per unit at the moment of receipt. */
    landedUnitCostPaise: integer('landed_unit_cost_paise').notNull(),
    /** The variant's weighted average cost before and after this receipt. */
    costBeforePaise: integer('cost_before_paise'),
    costAfterPaise: integer('cost_after_paise'),
  },
  (t) => [index('purchase_order_receipt_line_receipt').on(t.receiptId)],
)

const PURCHASE_DOCUMENT_KIND_VALUES = [
  'supplier_invoice',
  'bill_of_entry',
  'freight_bill',
  'cha_bill',
  'bank_advice',
  'other',
] as const
const PURCHASE_DOCUMENT_STATUS_VALUES = [
  'pending',
  'reading',
  'ready',
  'failed',
  'applied',
] as const

/**
 * A supplier or import document (invoice, Bill of Entry, freight, clearing or bank bill)
 * uploaded to a purchase order or an inbound shipment (exactly one, enforced by the service;
 * the check only demands an owner, as on `purchase_charge`). The file is private
 * (`stores/<store>/private/purchase-documents/...`) and only served through the admin API.
 * The worker reads it with AI into `extracted` (and keeps the PDF's own text in `raw_text`);
 * nothing reaches the order until the merchant reviews it and presses Apply (`applied_at`).
 */
export const purchaseDocument = pgTable(
  'purchase_document',
  {
    id: id(),
    storeId: storeId(),
    purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrder.id, {
      onDelete: 'cascade',
    }),
    inboundShipmentId: uuid('inbound_shipment_id').references(() => inboundShipment.id, {
      onDelete: 'cascade',
    }),
    kind: text('kind', { enum: PURCHASE_DOCUMENT_KIND_VALUES }).notNull(),
    fileKey: text('file_key').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    /** Better Auth user id of the member who uploaded it. */
    uploadedBy: text('uploaded_by'),
    status: text('status', { enum: PURCHASE_DOCUMENT_STATUS_VALUES }).notNull().default('pending'),
    /** What the AI read, shaped by the kind's schema (`@commerce/ai` purchase documents). */
    extracted: jsonb('extracted'),
    /** The PDF's own text layer, when it has one (scans and photos have none). */
    rawText: text('raw_text'),
    error: text('error'),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    appliedBy: text('applied_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('purchase_document_store_order').on(t.storeId, t.purchaseOrderId),
    index('purchase_document_store_shipment').on(t.storeId, t.inboundShipmentId),
    check(
      'purchase_document_kind_check',
      sql`${t.kind} in (${oneOf(PURCHASE_DOCUMENT_KIND_VALUES)})`,
    ),
    check(
      'purchase_document_status_check',
      sql`${t.status} in (${oneOf(PURCHASE_DOCUMENT_STATUS_VALUES)})`,
    ),
    check(
      'purchase_document_owner_check',
      sql`num_nonnulls(${t.purchaseOrderId}, ${t.inboundShipmentId}) >= 1`,
    ),
  ],
)
