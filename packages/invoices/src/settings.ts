import { validateGstin } from '@commerce/core/gstin'
import { z } from 'zod'
import { DEFAULT_SERIES, pickSeries, SERIES_KINDS, SeriesSchema, seriesProblem } from './series'
import type { DocumentKind } from './snapshot'

/** When the tax invoice is issued without anyone clicking a button. */
export const ISSUE_ON = ['payment', 'fulfilment', 'manual'] as const
export type IssueOn = (typeof ISSUE_ON)[number]

export const TEMPLATE_IDS = ['classic', 'minimal', 'compact'] as const
export type TemplateId = (typeof TEMPLATE_IDS)[number]

export const FONT_IDS = ['inter', 'noto', 'geist'] as const
export type FontId = (typeof FONT_IDS)[number]

export const PAPER_SIZES = ['A4', 'A5'] as const
export type PaperSize = (typeof PAPER_SIZES)[number]

/** Columns and blocks a merchant can switch off per document type. */
export const FIELD_KEYS = [
  'sku',
  'hsn',
  'discount',
  'unit',
  'taxBreakup',
  'signature',
  'terms',
  'notes',
  'customerGstin',
  'paymentMethod',
  'barcode',
] as const
export type FieldKey = (typeof FIELD_KEYS)[number]

/** Printed words a merchant can rename, e.g. "Bill to" as "Sold to". */
export const LABEL_KEYS = [
  'title',
  'billTo',
  'shipTo',
  'item',
  'quantity',
  'price',
  'amount',
  'total',
  'terms',
  'notes',
  'signature',
] as const
export type LabelKey = (typeof LABEL_KEYS)[number]

const HSN = /^[0-9]{4}([0-9]{2}){0,2}$/
const HEX = /^#[0-9a-fA-F]{6}$/

const FieldsSchema = z.object(
  Object.fromEntries(FIELD_KEYS.map((k) => [k, z.boolean().default(true)])) as Record<
    FieldKey,
    z.ZodDefault<z.ZodBoolean>
  >,
)
export type DocumentFields = z.infer<typeof FieldsSchema>

const LabelsSchema = z.object(
  Object.fromEntries(LABEL_KEYS.map((k) => [k, z.string().trim().max(40).default('')])) as Record<
    LabelKey,
    z.ZodDefault<z.ZodString>
  >,
)
export type DocumentLabels = z.infer<typeof LabelsSchema>

const DocumentConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** Null uses the store-wide template. */
  template: z.enum(TEMPLATE_IDS).nullable().default(null),
  /** Attach the PDF to the matching order email. */
  attachToEmail: z.boolean().default(false),
  fields: FieldsSchema.default(FieldsSchema.parse({})),
  labels: LabelsSchema.default(LabelsSchema.parse({})),
})
export type DocumentConfig = z.infer<typeof DocumentConfigSchema>

const docConfig = (overrides: Partial<z.input<typeof DocumentConfigSchema>> = {}) =>
  DocumentConfigSchema.default(DocumentConfigSchema.parse(overrides))

const SellerSchema = z.object({
  /** Name as registered for GST. */
  legalName: z.string().trim().max(160).default(''),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .default('')
    .superRefine((v, ctx) => {
      if (v === '') return
      const r = validateGstin(v)
      if (r.ok) return
      ctx.addIssue({
        code: 'custom',
        message:
          r.reason === 'checksum'
            ? 'This GSTIN fails its check digit; look for a typo'
            : r.reason === 'state'
              ? 'The first two digits are not a GST state code'
              : 'A GSTIN is 15 characters, like 27AAPFU0939F1ZV',
      })
    }),
  /** Two-letter state code, e.g. HR. */
  stateCode: z.string().trim().toUpperCase().max(2).default(''),
  line1: z.string().trim().max(200).default(''),
  line2: z.string().trim().max(200).default(''),
  city: z.string().trim().max(100).default(''),
  pincode: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[1-9][0-9]{5}$/.test(v), 'A PIN code is 6 digits')
    .default(''),
  email: z.string().trim().max(200).default(''),
  phone: z.string().trim().max(20).default(''),
})
export type SellerSettings = z.infer<typeof SellerSchema>

/**
 * Everything the GST invoices app stores for a store. Unknown or broken
 * blobs parse back to these defaults, so a new field never breaks an old row.
 */
export const InvoiceSettingsSchema = z
  .object({
    seller: SellerSchema.default(SellerSchema.parse({})),
    /** Media library items; resolved to URLs when a document is rendered. */
    logoMediaId: z.uuid().nullable().default(null),
    signatureMediaId: z.uuid().nullable().default(null),
    signatoryName: z.string().trim().max(80).default(''),

    /** Numbering series, in priority order; see series.ts. */
    series: z.array(SeriesSchema).min(1).max(30).default(DEFAULT_SERIES),
    /**
     * Exports are zero-rated (IGST Act s.16): under a Letter of Undertaking
     * without IGST, or with IGST paid and refunded later.
     */
    exportMode: z.enum(['lut', 'igst']).default('lut'),
    lutNumber: z.string().trim().max(40).default(''),
    /** The financial year the LUT covers, e.g. `2026-27`. */
    lutFy: z
      .string()
      .trim()
      .refine((v) => v === '' || /^20[0-9]{2}-[0-9]{2}$/.test(v), 'Use the form 2026-27')
      .default(''),

    /** Printed on lines whose variant has no HSN code of its own. */
    defaultHsn: z
      .string()
      .trim()
      .refine((v) => v === '' || HSN.test(v), 'HSN codes are 4, 6 or 8 digits')
      .default(''),
    /**
     * Notification 78/2020-Central Tax: 4 digits up to ₹5 crore aggregate
     * turnover in the previous year, 6 digits above it.
     */
    hsnDigits: z.union([z.literal(4), z.literal(6), z.literal(8)]).default(4),

    template: z.enum(TEMPLATE_IDS).default('classic'),
    accentColor: z
      .string()
      .trim()
      .refine((v) => HEX.test(v), 'Use a colour like #1f6feb')
      .default('#1f2937'),
    font: z.enum(FONT_IDS).default('inter'),
    paper: z.enum(PAPER_SIZES).default('A4'),

    terms: z.string().trim().max(1000).default(''),
    notes: z.string().trim().max(500).default(''),
    footer: z.string().trim().max(300).default(''),

    /** When an order joins the invoice queue. Pre-orders always wait for dispatch. */
    issueOn: z.enum(ISSUE_ON).default('payment'),
    /** Issue queue entries straight away (dated when they became eligible) instead of waiting for review. */
    autoIssue: z.boolean().default(false),
    /** Orders carrying this tag are pre-orders: invoiced at dispatch, the time of supply for goods. */
    preorderTag: z.string().trim().toLowerCase().max(40).default('pre-order'),
    /**
     * Invoice pre-orders when paid instead of at dispatch. Brings the tax
     * forward, and a cancellation then needs a credit note rather than a
     * refund voucher.
     */
    preorderInvoiceAtPayment: z.boolean().default(false),
    /** Date the annual return (GSTR-9) was filed; credit notes for that year stop then (s.34(2)). */
    gstr9FiledOn: z.iso.date().nullable().default(null),
    /** Link to the invoice in the payment and shipping emails. */
    emailLink: z.boolean().default(true),
    /** "Download invoice" on the storefront order page. */
    storefrontLink: z.boolean().default(true),
    /** Code 128 of the order number, or of the invoice number when there is one. */
    barcodeValue: z.enum(['order', 'document']).default('order'),

    documents: z
      .object({
        tax_invoice: docConfig({ attachToEmail: true }),
        credit_note: docConfig(),
        packing_slip: docConfig({ enabled: false }),
        order_confirmation: docConfig({ enabled: false }),
        receipt_voucher: docConfig(),
        refund_voucher: docConfig(),
      })
      .default({
        tax_invoice: DocumentConfigSchema.parse({ attachToEmail: true }),
        credit_note: DocumentConfigSchema.parse({}),
        packing_slip: DocumentConfigSchema.parse({ enabled: false }),
        order_confirmation: DocumentConfigSchema.parse({ enabled: false }),
        receipt_voucher: DocumentConfigSchema.parse({}),
        refund_voucher: DocumentConfigSchema.parse({}),
      }),
    /** Packing slips can leave prices off entirely. */
    packingSlipPrices: z.boolean().default(false),
  })
  .superRefine((s, ctx) => {
    const ids = new Set<string>()
    s.series.forEach((series, index) => {
      if (ids.has(series.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['series', index, 'id'],
          message: 'Series ids must be unique',
        })
      }
      ids.add(series.id)
      const problem = seriesProblem(series)
      if (problem)
        ctx.addIssue({ code: 'custom', path: ['series', index, 'pattern'], message: problem })
    })
    for (const kind of SERIES_KINDS) {
      for (const need of [
        { export: false, b2b: false },
        { export: true, b2b: false },
      ]) {
        if (!pickSeries(s.series, kind, need)) {
          ctx.addIssue({
            code: 'custom',
            path: ['series'],
            message: `Add a ${need.export ? 'export' : 'domestic'} series for ${kind.replace('_', ' ')}s`,
          })
        }
      }
    }
  })

export type InvoiceSettings = z.infer<typeof InvoiceSettingsSchema>
export type InvoiceSettingsInput = z.input<typeof InvoiceSettingsSchema>

export const defaultInvoiceSettings: InvoiceSettings = InvoiceSettingsSchema.parse({})

/** Stored blob to settings; anything unreadable falls back to the defaults. */
export function parseInvoiceSettings(raw: unknown): InvoiceSettings {
  const r = InvoiceSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultInvoiceSettings
}

/**
 * Whether an event makes an order eligible for the invoice queue. Pre-orders
 * only become eligible at dispatch: for goods the time of supply is removal,
 * not the order date.
 */
export function isEligible(
  settings: InvoiceSettings,
  event: 'paid' | 'fulfilled',
  preorder: boolean,
): boolean {
  if (!settings.documents.tax_invoice.enabled || settings.issueOn === 'manual') return false
  if ((preorder && !settings.preorderInvoiceAtPayment) || settings.issueOn === 'fulfilment') {
    return event === 'fulfilled'
  }
  return event === 'paid' || event === 'fulfilled'
}

/** The template a document type prints with. */
export const templateFor = (settings: InvoiceSettings, kind: DocumentKind): TemplateId =>
  settings.documents[kind].template ?? settings.template
