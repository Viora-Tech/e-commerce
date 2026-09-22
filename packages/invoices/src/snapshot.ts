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
] as const
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

/** Kinds that take a number from the GST series; the rest reuse the order number. */
export const NUMBERED_KINDS = ['tax_invoice', 'credit_note'] as const
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
  einvoice: z
    .object({ irn: z.string(), ackNumber: z.string(), ackDate: z.string(), qrPng: z.string() })
    .nullable()
    .default(null),
})
export type DocumentSnapshot = z.infer<typeof DocumentSnapshotSchema>
