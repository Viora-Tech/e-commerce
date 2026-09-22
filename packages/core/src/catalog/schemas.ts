import { z } from 'zod'

export const ProductStatusSchema = z.enum(['draft', 'active', 'archived'])
export type ProductStatus = z.infer<typeof ProductStatusSchema>

export const HandleSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens')

/** Lexical JSON document. Only the shape is checked; the renderer sanitises content. */
export const RichTextSchema = z.object({ root: z.record(z.string(), z.unknown()) }).passthrough()

const paise = z.number().int().min(0).max(1_000_000_000)

export const VariantInputSchema = z.object({
  id: z.uuid().optional(),
  optionValues: z.array(z.string().trim().min(1).max(100)).max(3),
  sku: z.string().trim().max(100).nullable().optional(),
  barcode: z.string().trim().max(100).nullable().optional(),
  pricePaise: paise,
  mrpPaise: paise.nullable().optional(),
  costPaise: paise.nullable().optional(),
  taxable: z.boolean().optional(),
  trackInventory: z.boolean().optional(),
  weightGrams: z.number().int().min(0).max(1_000_000).nullable().optional(),
  hsCode: z.string().trim().max(20).nullable().optional(),
  countryOfOrigin: z.string().trim().max(2).nullable().optional(),
  /** Null uses the store's GST rate. */
  gstRatePercent: z.number().int().min(0).max(40).nullable().optional(),
  onHand: z.number().int().min(0).max(1_000_000).optional(),
  mediaId: z.uuid().nullable().optional(),
})

export const OptionInputSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(50),
  values: z
    .array(z.object({ id: z.uuid().optional(), value: z.string().trim().min(1).max(100) }))
    .min(1)
    .max(100),
})

export const ProductFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  handle: HandleSchema.optional(),
  description: RichTextSchema.nullable().optional(),
  vendor: z.string().trim().max(100).nullable().optional(),
  productType: z.string().trim().max(100).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(100).optional(),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(320).nullable().optional(),
  status: ProductStatusSchema.optional(),
  /** Prices already carry tax; the GST split is extracted rather than added. */
  taxIncluded: z.boolean().optional(),
  /** Shown in the storefront's featured section. */
  featured: z.boolean().optional(),
  /** Window the compare-at price applies in; both null means it always applies. */
  saleStartsAt: z.coerce.date().nullable().optional(),
  saleEndsAt: z.coerce.date().nullable().optional(),
})

export const InventoryReasonSchema = z.enum([
  'correction',
  'received',
  'damaged',
  'returned',
  'theft',
  'transfer',
  'sold',
  'other',
])
export type InventoryReason = z.infer<typeof InventoryReasonSchema>

export const ProductWriteSchema = ProductFieldsSchema.extend({
  options: z.array(OptionInputSchema).max(3).default([]),
  variants: z.array(VariantInputSchema).min(1).max(100),
  /** Logged against every on-hand change in this write. */
  inventoryReason: InventoryReasonSchema.optional(),
  /** Gallery in display order, cover first. Omitted = leave the gallery alone. */
  mediaIds: z.array(z.uuid()).max(50).optional(),
})
export type ProductWrite = z.infer<typeof ProductWriteSchema>
