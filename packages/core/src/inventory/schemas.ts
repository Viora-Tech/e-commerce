import { z } from 'zod'

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

export const PurchaseOrderLineInputSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100_000),
  unitCostPaise: z.number().int().min(0).max(100_000_000),
})

/** Each product may appear on a document once; two lines for one variant should be one. */
const hasUniqueVariants = (lines: { variantId: string }[]) =>
  new Set(lines.map((l) => l.variantId)).size === lines.length
const UNIQUE_LINES = { message: 'Each product can only be added once', path: ['lines'] }

export const PurchaseOrderInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    supplierName: z.string().trim().min(1).max(120),
    supplierEmail: z.string().trim().email().optional().or(z.literal('')),
    supplierPhone: z.string().trim().max(20).optional(),
    locationId: z.string().uuid(),
    expectedAt: z.coerce.date().nullable().optional(),
    shippingPaise: z.number().int().min(0).default(0),
    taxPaise: z.number().int().min(0).default(0),
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
    .array(z.object({ lineId: z.string().uuid(), quantity: z.number().int().min(0) }))
    .min(1),
})
export type Receipt = z.infer<typeof ReceiptSchema>

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
