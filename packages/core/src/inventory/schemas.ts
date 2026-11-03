import { z } from 'zod'
import { lenientPhone } from '../accounts/phone'
import { INBOUND_CARRIER_IDS, type InboundCarrier } from './inbound-tracking'
import {
  INBOUND_SHIPMENT_STATUSES,
  PURCHASE_CHARGE_KINDS,
  PURCHASE_CURRENCY_CODES,
  type PurchaseCurrency,
  parseFxRate,
  SPLIT_METHODS,
} from './landed-cost'

/** Reasons a merchant can pick when editing stock by hand. */
export const ManualReasonSchema = z.enum(['correction', 'received', 'damaged', 'returned', 'theft'])
export type ManualReason = z.infer<typeof ManualReasonSchema>

export const LocationInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  line1: z.string().trim().max(200).optional(),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  stateCode: z.string().trim().max(8).optional(),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/)
    .optional()
    .or(z.literal('')),
  phone: z.string().trim().max(20).optional(),
})
export type LocationInput = z.infer<typeof LocationInputSchema>

/** Every field is written: a blank one clears it (except `line2`, kept when left out). */
export const LocationUpdateSchema = LocationInputSchema.extend({ id: z.uuid() })
export type LocationUpdate = z.infer<typeof LocationUpdateSchema>

export const StockEditSchema = z.object({
  variantId: z.string().uuid(),
  locationId: z.string().uuid(),
  mode: z.enum(['adjust', 'set']),
  value: z.number().int().min(-1_000_000).max(1_000_000),
  reason: ManualReasonSchema,
  note: z.string().trim().max(500).optional(),
})
export type StockEdit = z.infer<typeof StockEditSchema>

export const BulkStockEditSchema = StockEditSchema.omit({ variantId: true }).extend({
  variantIds: z.array(z.string().uuid()).min(1).max(500),
})
export type BulkStockEdit = z.infer<typeof BulkStockEditSchema>

const PurchaseCurrencySchema = z.enum(
  PURCHASE_CURRENCY_CODES as [PurchaseCurrency, ...PurchaseCurrency[]],
)

/** INR per one unit of the currency, up to six decimals, above zero ('83.25'). */
export const FxRateSchema = z
  .string()
  .trim()
  .refine((s) => parseFxRate(s) !== null, { message: 'Enter an exchange rate above 0' })

const optionalText = (max: number) => z.string().trim().max(max).optional()
/** yyyy-mm-dd, as a date input gives it. */
const DayOrNull = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()

export const PurchaseOrderLineInputSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100_000),
  /** Price per unit in the order's currency, minor units (cents, paise). */
  unitPriceMinor: z.number().int().min(0).max(1_000_000_000),
  hsnCode: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, { message: 'An HSN code has 4 to 8 digits' })
    .optional()
    .or(z.literal('')),
})

/** Each product may appear on a document once; two lines for one variant should be one. */
const hasUniqueVariants = (lines: { variantId: string }[]) =>
  new Set(lines.map((l) => l.variantId)).size === lines.length
const UNIQUE_LINES = { message: 'Each product can only be added once', path: ['lines'] }

export const PurchaseOrderInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    /** A saved supplier; its name, email and phone are copied onto the order. */
    supplierId: z.string().uuid().nullable().optional(),
    supplierName: z.string().trim().min(1).max(120),
    /** The merchant's own name for the order ("Diwali restock"); the number stays. */
    name: z.string().trim().max(120).optional(),
    supplierEmail: z.string().trim().email().optional().or(z.literal('')),
    supplierPhone: z.string().trim().max(20).optional(),
    locationId: z.string().uuid(),
    expectedAt: z.coerce.date().nullable().optional(),
    currency: PurchaseCurrencySchema.default('INR'),
    fxRate: FxRateSchema.default('1'),
    note: z.string().trim().max(2000).optional(),
    lines: z.array(PurchaseOrderLineInputSchema).max(500),
    /** Also send the draft to the supplier, in the same step as saving it. */
    markOrdered: z.boolean().optional(),
  })
  .refine((po) => hasUniqueVariants(po.lines), UNIQUE_LINES)
export type PurchaseOrderInput = z.infer<typeof PurchaseOrderInputSchema>

export const ReceiptSchema = z.object({
  id: z.string().uuid(),
  receipts: z
    .array(
      z.object({
        lineId: z.string().uuid(),
        /** Units that go on hand. */
        accepted: z.number().int().min(0),
        /** Units that arrived but are refused; they stop being incoming and are not stocked. */
        rejected: z.number().int().min(0).default(0),
      }),
    )
    .min(1),
  note: optionalText(500),
})
export type Receipt = z.infer<typeof ReceiptSchema>

/** More ways to reach a supplier (#1064), beyond the main email and phone. */
export const SUPPLIER_CONTACT_KINDS = [
  'whatsapp',
  'wechat',
  'phone',
  'email',
  'website',
  'other',
] as const
export type SupplierContactKind = (typeof SUPPLIER_CONTACT_KINDS)[number]

const SupplierContactSchema = z.object({
  kind: z.enum(SUPPLIER_CONTACT_KINDS),
  value: z.string().trim().min(1).max(200),
  label: optionalText(60),
})

export const SupplierInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9]{2}[A-Z0-9]{13}$/, { message: 'A GSTIN has 15 letters and digits' })
    .optional()
    .or(z.literal('')),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .default('IN'),
  currency: PurchaseCurrencySchema.default('INR'),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: lenientPhone(20).optional(),
  address: optionalText(500),
  /** Left out: the supplier keeps the ones it has (the quick-add dialog doesn't send them). */
  contacts: z.array(SupplierContactSchema).max(10).optional(),
  paymentTerms: optionalText(200),
  notes: optionalText(2000),
})
export type SupplierInput = z.infer<typeof SupplierInputSchema>

/** Bulk edit on the suppliers list (#1064): only the fields given change. */
export const SupplierBulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  currency: PurchaseCurrencySchema.optional(),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  /** An empty string clears the terms. */
  paymentTerms: z.string().trim().max(200).optional(),
})
export type SupplierBulkUpdate = z.infer<typeof SupplierBulkUpdateSchema>

export const InboundShipmentInputSchema = z.object({
  id: z.string().uuid().optional(),
  reference: optionalText(120),
  billOfEntryNo: optionalText(40),
  billOfEntryDate: DayOrNull,
  port: optionalText(80),
  /** `INBOUND_CARRIERS` id; tracking number and page, and the date it should arrive. */
  carrier: z
    .enum(INBOUND_CARRIER_IDS as [InboundCarrier, ...InboundCarrier[]])
    .nullable()
    .optional(),
  trackingNumber: optionalText(60),
  trackingUrl: z.url().max(500).optional().or(z.literal('')),
  expectedAt: DayOrNull,
  arrivedAt: z.coerce.date().nullable().optional(),
  status: z.enum(INBOUND_SHIPMENT_STATUSES).default('in_transit'),
  note: optionalText(2000),
})
export type InboundShipmentInput = z.infer<typeof InboundShipmentInputSchema>

const ChargeFieldsSchema = z.object({
  kind: z.enum(PURCHASE_CHARGE_KINDS),
  /** Ex-GST, in the charge's currency minor units. Negative only for a goods adjustment (a credit). */
  amountMinor: z.number().int().min(-1_000_000_000_000).max(1_000_000_000_000),
  currency: PurchaseCurrencySchema.default('INR'),
  fxRate: FxRateSchema.default('1'),
  /** GST on the bill, in paise: input credit, never cost. */
  gstPaise: z.number().int().min(0).max(1_000_000_000_000).default(0),
  /** Defaults by kind: IGST at customs is recoverable, the rest is cost. */
  recoverable: z.boolean().optional(),
  /** Defaults by kind: freight and insurance by weight, everything else by value. */
  splitMethod: z.enum(SPLIT_METHODS).optional(),
  splitLineIds: z.array(z.string().uuid()).max(500).optional(),
  manualSplits: z
    .array(z.object({ lineId: z.string().uuid(), amountPaise: z.number().int() }))
    .max(500)
    .optional(),
  payee: optionalText(120),
  note: optionalText(500),
  incurredAt: DayOrNull,
})

type ChargeFields = z.infer<typeof ChargeFieldsSchema>
const creditOnlyForGoods = (c: ChargeFields) => c.amountMinor >= 0 || c.kind === 'goods_adjustment'
const CREDIT_RULE = {
  message: 'Only a goods adjustment can be negative',
  path: ['amountMinor'],
}
const splitHasLines = (c: ChargeFields) =>
  (c.splitMethod !== 'specific_lines' || (c.splitLineIds?.length ?? 0) > 0) &&
  (c.splitMethod !== 'manual' || (c.manualSplits?.length ?? 0) > 0)
const SPLIT_RULE = { message: 'Pick the lines this charge goes on', path: ['splitMethod'] }

/** A new charge on exactly one purchase order or one inbound shipment. */
export const PurchaseChargeInputSchema = ChargeFieldsSchema.extend({
  purchaseOrderId: z.string().uuid().optional(),
  inboundShipmentId: z.string().uuid().optional(),
})
  .refine((c) => (c.purchaseOrderId ? 1 : 0) + (c.inboundShipmentId ? 1 : 0) === 1, {
    message: 'A charge belongs to one purchase order or one inbound shipment',
    path: ['purchaseOrderId'],
  })
  .refine(creditOnlyForGoods, CREDIT_RULE)
  .refine(splitHasLines, SPLIT_RULE)
export type PurchaseChargeInput = z.infer<typeof PurchaseChargeInputSchema>

/** Edit a charge; it stays where it is. */
export const PurchaseChargeUpdateSchema = ChargeFieldsSchema.extend({ id: z.string().uuid() })
  .refine(creditOnlyForGoods, CREDIT_RULE)
  .refine(splitHasLines, SPLIT_RULE)
export type PurchaseChargeUpdate = z.infer<typeof PurchaseChargeUpdateSchema>

export const TransferInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    fromLocationId: z.string().uuid(),
    toLocationId: z.string().uuid(),
    note: z.string().trim().max(2000).optional(),
    lines: z
      .array(
        z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(100_000) }),
      )
      .min(1)
      .max(500),
  })
  .refine((t) => t.fromLocationId !== t.toLocationId, {
    message: 'Pick two different locations',
    path: ['toLocationId'],
  })
  .refine((t) => hasUniqueVariants(t.lines), UNIQUE_LINES)
export type TransferInput = z.infer<typeof TransferInputSchema>

/** A charge an applied document creates on its own order or shipment. */
const DocumentChargeSchema = ChargeFieldsSchema.refine(creditOnlyForGoods, CREDIT_RULE).refine(
  splitHasLines,
  SPLIT_RULE,
)
export type DocumentCharge = z.infer<typeof DocumentChargeSchema>

/**
 * What the merchant ticked on the review screen, with the values they confirmed (the AI's
 * reading, corrected where needed). Applied in one transaction by `applyPurchaseDocument`.
 */
export const ApplyDocumentSchema = z
  .object({
    id: z.string().uuid(),
    /**
     * Draft orders only: lines to set. `lineId` updates that line; without it the variant
     * is added. Lines not named stay as they are.
     */
    lines: z
      .array(PurchaseOrderLineInputSchema.extend({ lineId: z.string().uuid().optional() }))
      .max(500)
      .default([]),
    /** The order's currency (drafts only) and rate; on a shipment, the rate for its orders in `currency`. */
    currency: PurchaseCurrencySchema.optional(),
    fxRate: FxRateSchema.optional(),
    /** Bill of Entry number, date and port, onto the inbound shipment. */
    billOfEntry: z
      .object({ number: optionalText(40), date: DayOrNull, port: optionalText(80) })
      .optional(),
    charges: z.array(DocumentChargeSchema).max(50).default([]),
  })
  .refine((a) => hasUniqueVariants(a.lines), UNIQUE_LINES)
  .refine((a) => !a.fxRate || a.currency !== undefined, {
    message: 'Say which currency the rate is for',
    path: ['currency'],
  })
export type ApplyDocument = z.infer<typeof ApplyDocumentSchema>

/** "Email to supplier": the PDF goes to `to`, with the merchant's own words above it. */
export const EmailPurchaseOrderSchema = z.object({
  id: z.string().uuid(),
  to: z.string().trim().toLowerCase().email().max(254),
  message: z.string().trim().max(2000).default(''),
  /** Drafts only: mark it ordered in the same step, so stock shows as incoming. */
  markOrdered: z.boolean().default(false),
})
export type EmailPurchaseOrderInput = z.input<typeof EmailPurchaseOrderSchema>
