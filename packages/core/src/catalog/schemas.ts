import { SEO_KEYWORD_LENGTH_MAX, SEO_KEYWORDS_MAX } from '@commerce/ai/client'
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

/** Units a variant's weight can be typed in on the product page (`variant.weight_unit`). */
export const WEIGHT_UNITS = ['g', 'kg', 'lb', 'oz'] as const
const WeightUnitSchema = z.enum(WEIGHT_UNITS)
export type WeightUnit = z.infer<typeof WeightUnitSchema>

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
  /** Unit the product page shows the weight in; grams stay the source of truth. Null shows kg. */
  weightUnit: WeightUnitSchema.nullable().optional(),
  hsCode: z.string().trim().max(20).nullable().optional(),
  countryOfOrigin: z.string().trim().max(2).nullable().optional(),
  /** One of the store's named boxes (Settings → Shipping); null with dims set means a custom box. */
  boxPresetId: z.string().trim().max(60).nullable().optional(),
  packageLengthCm: z.number().int().min(1).max(200).nullable().optional(),
  packageWidthCm: z.number().int().min(1).max(200).nullable().optional(),
  packageHeightCm: z.number().int().min(1).max(200).nullable().optional(),
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

export const PreorderPaymentModeSchema = z.enum(['full', 'fixed', 'percentage'])

export const ProductFieldsSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    handle: HandleSchema.optional(),
    description: RichTextSchema.nullable().optional(),
    vendor: z.string().trim().max(100).nullable().optional(),
    /** Shopify Standard Product Taxonomy category id (e.g. "aa-1-1"); `productType` stays separate free text. */
    categoryId: z.string().trim().max(40).nullable().optional(),
    productType: z.string().trim().max(100).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(100).optional(),
    seoTitle: z.string().trim().max(70).nullable().optional(),
    seoDescription: z.string().trim().max(320).nullable().optional(),
    /** Search keywords, primary first; left out means unchanged. They steer Write with AI only. */
    seoKeywords: z
      .array(z.string().trim().min(1).max(SEO_KEYWORD_LENGTH_MAX))
      .max(SEO_KEYWORDS_MAX)
      .optional(),
    /** Alternate product template (`product.<suffix>`); blank or null is the default. */
    templateSuffix: z
      .string()
      .regex(/^[a-z0-9-]{0,40}$/)
      .nullable()
      .optional(),
    status: ProductStatusSchema.optional(),
    /** Prices already carry tax; the GST split is extracted rather than added. */
    taxIncluded: z.boolean().optional(),
    /** Shown in the storefront's featured section. */
    featured: z.boolean().optional(),
    /** Window the compare-at price applies in; both null means it always applies. */
    saleStartsAt: z.coerce.date().nullable().optional(),
    saleEndsAt: z.coerce.date().nullable().optional(),
    /** Purchasable beyond stock up to `preorderLimit`; see `@commerce/core/preorder`. */
    preorderEnabled: z.boolean().optional(),
    preorderShipDate: z.coerce.date().nullable().optional(),
    preorderShipsInDays: z.number().int().min(0).max(3650).nullable().optional(),
    preorderLimit: z.number().int().min(1).max(1_000_000).nullable().optional(),
    preorderButtonLabel: z.string().trim().min(1).max(60).optional(),
    preorderPaymentMode: PreorderPaymentModeSchema.optional(),
    preorderDepositPaise: paise.nullable().optional(),
    preorderDepositPercent: z.number().int().min(1).max(99).nullable().optional(),
    preorderHideFromCollectionsUntilLaunch: z.boolean().optional(),
    /** Store-timezone instant the product goes on sale; null = always on sale. */
    launchAt: z.coerce.date().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.preorderEnabled) return
    if (v.preorderPaymentMode === 'fixed' && !v.preorderDepositPaise) {
      ctx.addIssue({
        code: 'custom',
        path: ['preorderDepositPaise'],
        message: 'A fixed deposit needs an amount greater than zero',
      })
    }
    if (v.preorderPaymentMode === 'percentage' && !v.preorderDepositPercent) {
      ctx.addIssue({
        code: 'custom',
        path: ['preorderDepositPercent'],
        message: 'A percentage deposit needs a value between 1 and 99',
      })
    }
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
