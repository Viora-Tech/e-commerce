/**
 * SOURCE OF TRUTH: what the AI reads out of a purchase document — WHAT the three document
 * shapes (supplier invoice, Bill of Entry, service bill), their zod schemas with a confidence
 * on every field, and the stored `{ shape, data }` envelope / WHY the model, the worker, the
 * review screen and the tests agree on one shape per document. Client-safe.
 *
 * Amounts are plain numbers in the document's own currency, major units (12.40 dollars,
 * 18500.00 rupees), exactly as printed; the review converts them to minor units. Every field
 * is `{ value, confidence }` so the review can flag what the AI was unsure about.
 */
import { z } from 'zod'

/** Shapes the AI knows. Freight, clearing (CHA) and bank bills share the service bill. */
export const DOCUMENT_SHAPES = ['supplier_invoice', 'bill_of_entry', 'service_bill'] as const
export type DocumentShape = (typeof DOCUMENT_SHAPES)[number]

/** Marks the call for the offline mock model, which answers with a fixture per shape. */
export const DOCUMENT_READ_MARKER = 'Task: read a purchase document'

/** Below this the review marks a field "check this". */
export const LOW_CONFIDENCE = 0.7

const CONFIDENCE = z
  .number()
  .describe('How sure you are of this value, 0 to 1. Use 0 when the value is null.')

const text = (description: string) =>
  z
    .object({ value: z.string().nullable(), confidence: CONFIDENCE })
    .describe(`${description} Null when the document does not show it.`)

const amount = (description: string) =>
  z
    .object({ value: z.number().nullable(), confidence: CONFIDENCE })
    .describe(
      `${description} A plain number in major units as printed (12.40, 18500), no symbols or thousands separators. Null when not shown.`,
    )

const day = (description: string) => text(`${description} As YYYY-MM-DD.`)
const currency = text('ISO 4217 currency code of the amounts (USD, CNY, INR, EUR).')

export const SupplierInvoiceSchema = z.object({
  supplierName: text('The seller: company name on the invoice header.'),
  invoiceNumber: text('Invoice number.'),
  invoiceDate: day('Invoice date.'),
  currency,
  lines: z
    .array(
      z.object({
        description: text('Item description as printed.'),
        supplierSku: text('Supplier item code, model or SKU.'),
        hsnCode: text('HS or HSN code, digits only.'),
        quantity: amount('Quantity invoiced, in units.'),
        unitPrice: amount('Price per unit.'),
        lineTotal: amount('Line amount (quantity times price).'),
      }),
    )
    .describe('One entry per goods line, in the order printed. Leave out subtotal rows.'),
  freight: amount('Freight charged on the invoice, if listed separately.'),
  insurance: amount('Insurance charged on the invoice, if listed separately.'),
  total: amount('Invoice grand total.'),
})
export type SupplierInvoice = z.infer<typeof SupplierInvoiceSchema>

export const BillOfEntrySchema = z.object({
  beNumber: text('Bill of Entry number.'),
  beDate: day('Bill of Entry date.'),
  port: text('Port code or name (for example INNSA1, Nhava Sheva).'),
  currency: text('ISO 4217 code of the invoice currency the exchange rate is for.'),
  exchangeRate: amount('Exchange rate customs used: rupees for one unit of that currency.'),
  lines: z
    .array(
      z.object({
        description: text('Item description.'),
        hsnCode: text('CTH / HSN code, digits only.'),
        quantity: amount('Quantity, in units.'),
        assessableValue: amount('Assessable value in rupees.'),
        bcd: amount('Basic Customs Duty in rupees.'),
        sws: amount('Social Welfare Surcharge in rupees.'),
        igst: amount('Integrated GST in rupees.'),
      }),
    )
    .describe('One entry per item line, in the order printed.'),
  totalAssessableValue: amount('Total assessable value in rupees.'),
  totalBcd: amount('Total Basic Customs Duty in rupees.'),
  totalSws: amount('Total Social Welfare Surcharge in rupees.'),
  totalIgst: amount('Total IGST in rupees.'),
})
export type BillOfEntry = z.infer<typeof BillOfEntrySchema>

export const ServiceBillSchema = z.object({
  payee: text('Who issued the bill (forwarder, clearing agent, bank).'),
  billNumber: text('Bill or invoice number.'),
  billDate: day('Bill date.'),
  currency,
  amount: amount('Taxable amount before GST.'),
  gst: amount('GST on the bill (CGST plus SGST, or IGST), in the bill currency.'),
  total: amount('Total payable including GST.'),
  description: text('What the bill is for, a few words (ocean freight, clearing charges).'),
})
export type ServiceBill = z.infer<typeof ServiceBillSchema>

export const DOCUMENT_SCHEMAS = {
  supplier_invoice: SupplierInvoiceSchema,
  bill_of_entry: BillOfEntrySchema,
  service_bill: ServiceBillSchema,
} as const

/** What `purchase_document.extracted` holds. */
export type ExtractedDocument =
  | { shape: 'supplier_invoice'; data: SupplierInvoice }
  | { shape: 'bill_of_entry'; data: BillOfEntry }
  | { shape: 'service_bill'; data: ServiceBill }

/** A stored extraction, checked against its shape's schema; null when it no longer fits. */
export function parseExtracted(raw: unknown): ExtractedDocument | null {
  if (!raw || typeof raw !== 'object') return null
  const { shape, data } = raw as { shape?: unknown; data?: unknown }
  if (!DOCUMENT_SHAPES.includes(shape as DocumentShape)) return null
  const parsed = DOCUMENT_SCHEMAS[shape as DocumentShape].safeParse(data)
  return parsed.success ? ({ shape, data: parsed.data } as ExtractedDocument) : null
}
