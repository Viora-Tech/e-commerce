import { z } from 'zod'

/**
 * What a document says, frozen when it is issued. Stored as jsonb on the
 * invoice row and handed to the templates as is, so a later rename, price
 * change or settings edit never rewrites a document that already went out.
 * Every amount is integer paise.
 */

export const DOCUMENT_KINDS = [
  'tax_invoice',
  'credit_note',
  'packing_slip',
  'order_confirmation',
  /** Rule 50: money received before supply (a paid pre-order). No GST on goods advances. */
  'receipt_voucher',
  /** Rule 51: an advance returned before any supply. */
  'refund_voucher',
] as const
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

/** Kinds that take a number from the GST series; the rest reuse the order number. */
export const NUMBERED_KINDS = [
  'tax_invoice',
  'credit_note',
  'receipt_voucher',
  'refund_voucher',
] as const
export type NumberedKind = (typeof NUMBERED_KINDS)[number]
export const isNumberedKind = (kind: DocumentKind): kind is NumberedKind =>
  (NUMBERED_KINDS as readonly string[]).includes(kind)

const paise = z.number().int()

export const PlaceSchema = z.object({
  /** Two-letter code, e.g. HR. */
  code: z.string(),
  /** GST numeric state code, e.g. 06. */
  gstCode: z.string(),
  name: z.string(),
})
export type Place = z.infer<typeof PlaceSchema>

/** Anyone named on a document: seller, buyer, ship-to. */
export const PartySchema = z.object({
  name: z.string(),
  gstin: z.string().nullable(),
  /** Printed lines, top to bottom. */
  address: z.array(z.string()),
  state: PlaceSchema.nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
})
export type Party = z.infer<typeof PartySchema>

export const DocumentLineSchema = z.object({
  description: z.string(),
  sku: z.string().nullable(),
  hsn: z.string(),
  quantity: z.number().int(),
  /** Unit quantity code (UQC). Retail goods sell in numbers. */
  unit: z.string(),
  /** Tax-inclusive price per unit as charged. */
  unitPricePaise: paise,
  /** quantity × unit price, before order-level reductions. */
  grossPaise: paise,
  discountPaise: paise,
  /** Value tax is levied on: gross less discount less the tax inside it. */
  taxablePaise: paise,
  ratePercent: z.number().min(0),
  cgstPaise: paise,
  sgstPaise: paise,
  igstPaise: paise,
  /** Taxable value plus tax: what the buyer paid for this line. */
  totalPaise: paise,
  /** Shipping or a payment fee rather than goods; packing slips leave these out. */
  charge: z.boolean(),
  /**
   * The order line a goods line bills, so a credit note for a return credits exactly the units
   * that came back. Absent on charges and on invoices issued before it was recorded.
   */
  orderLineId: z.string().optional(),
})
export type DocumentLine = z.infer<typeof DocumentLineSchema>

export const TaxRowSchema = z.object({
  ratePercent: z.number().min(0),
  taxablePaise: paise,
  cgstPaise: paise,
  sgstPaise: paise,
  igstPaise: paise,
})
export type TaxRow = z.infer<typeof TaxRowSchema>

export const HsnRowSchema = TaxRowSchema.extend({
  hsn: z.string(),
  quantity: z.number().int(),
})
export type HsnRow = z.infer<typeof HsnRowSchema>

export const DocumentTotalsSchema = z.object({
  grossPaise: paise,
  discountPaise: paise,
  taxablePaise: paise,
  cgstPaise: paise,
  sgstPaise: paise,
  igstPaise: paise,
  taxPaise: paise,
  totalPaise: paise,
})
export type DocumentTotals = z.infer<typeof DocumentTotalsSchema>

/**
 * Rule 46 endorsement on an export invoice. Exports are zero-rated (IGST Act
 * s.16): under a Letter of Undertaking without IGST, or with IGST paid.
 */
export const EXPORT_ENDORSEMENTS = {
  lut: 'SUPPLY MEANT FOR EXPORT UNDER LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX',
  igst: 'SUPPLY MEANT FOR EXPORT ON PAYMENT OF INTEGRATED TAX',
} as const

/** Place of supply for exports as the GST return expects it: state code 96, Other Country. */
export const OUTSIDE_INDIA = { code: 'OT', gstCode: '96', name: 'Outside India' } as const

export const ExportSupplySchema = z.object({
  mode: z.enum(['lut', 'igst']),
  /** ISO country of the delivery address, e.g. AE. */
  country: z.string(),
  countryName: z.string(),
  lutNumber: z.string().nullable(),
  endorsement: z.string(),
  portCode: z.string().nullable(),
  shippingBillNumber: z.string().nullable(),
  /** ISO date. */
  shippingBillDate: z.string().nullable(),
  /** Optional: the foreign currency shown beside INR, and the rate used. */
  currency: z.string().nullable(),
  exchangeRate: z.number().positive().nullable(),
})
export type ExportSupply = z.infer<typeof ExportSupplySchema>

export const DocumentSnapshotSchema = z.object({
  version: z.literal(1),
  kind: z.enum(DOCUMENT_KINDS),
  /** GST serial for invoices and credit notes; null on slips and confirmations. */
  number: z.string().nullable(),
  /** ISO timestamp. */
  issuedAt: z.string(),
  order: z.object({
    id: z.string(),
    /** As shown to the shopper, e.g. "#1042". */
    name: z.string(),
    placedAt: z.string(),
    paymentMethod: z.string().nullable(),
    /** Cash on delivery still to collect; 0 when prepaid. */
    collectPaise: paise,
  }),
  /**
   * A pre-order's tax invoice: the receipt voucher (rule 50) its advance was
   * recorded on, adjusted against the invoice value. Absent on older snapshots.
   */
  advance: z
    .object({ number: z.string(), issuedAt: z.string(), amountPaise: paise })
    .nullable()
    .default(null),
  /** Rule 53(1A)(d): the invoice a credit note is against. */
  original: z.object({ number: z.string(), issuedAt: z.string() }).nullable(),
  reason: z.string().nullable(),
  seller: PartySchema,
  buyer: PartySchema,
  shipTo: PartySchema.nullable(),
  /** Where the goods are delivered: the place of supply for goods sent to an address. */
  placeOfSupply: PlaceSchema.nullable(),
  interState: z.boolean(),
  /** Rule 46(p). Retail sales by a registered supplier are never under reverse charge. */
  reverseCharge: z.literal(false),
  lines: z.array(DocumentLineSchema),
  taxSummary: z.array(TaxRowSchema),
  hsnSummary: z.array(HsnRowSchema),
  totals: DocumentTotalsSchema,
  amountInWords: z.string(),
  /**
   * Reserved for e-invoicing: the IRN and signed QR the IRP returns. Templates
   * print the QR in its slot when this is set; nothing fills it yet.
   */
  /** Set on export invoices (and their credit notes and vouchers). */
  exportSupply: ExportSupplySchema.nullable().default(null),
  /** Issued under the composition scheme (Settings › Taxes & GST). Absent on older snapshots. */
  composition: z.boolean().default(false),
  einvoice: z
    .object({ irn: z.string(), ackNumber: z.string(), ackDate: z.string(), qrPng: z.string() })
    .nullable()
    .default(null),
})
export type DocumentSnapshot = z.infer<typeof DocumentSnapshotSchema>
