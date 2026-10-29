/** SOURCE OF TRUTH: BULK_EDIT_MAX, BulkEditRow, BulkEditResult, bulk editor field limits — WHAT one
 * spreadsheet-style save sends and returns / WHY the admin grid and the batched API share one
 * shape: the grid validates the same fields the server re-checks. Browser-safe, no database;
 * the transaction is `bulk-edit.ts`.
 */
import { z } from 'zod'
import { HandleSchema, ProductStatusSchema } from './schemas'

/** Most variant rows one bulk-edit save may carry. */
export const BULK_EDIT_MAX = 500

const paise = z.number().int().min(0).max(1_000_000_000)

/** Product-level cells; every variant row of one product repeats them and they must agree. */
export const BulkEditProductPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    status: ProductStatusSchema,
    vendor: z.string().trim().max(100).nullable(),
    productType: z.string().trim().max(100).nullable(),
    tags: z.array(z.string().trim().min(1).max(50)).max(100),
    /** URL handle; changing it leaves a redirect from the old one, as the product form does. */
    handle: HandleSchema,
    seoTitle: z.string().trim().max(70).nullable(),
    seoDescription: z.string().trim().max(320).nullable(),
    featured: z.boolean(),
    taxIncluded: z.boolean(),
    /** Alternate product template (`product.<suffix>`); null is the default. */
    templateSuffix: z
      .string()
      .regex(/^[a-z0-9-]{0,40}$/)
      .nullable(),
    /** The manual collections the product sits in; automatic ones follow their rules. */
    collectionIds: z.array(z.uuid()).max(100),
  })
  .partial()

export const BulkEditVariantPatchSchema = z
  .object({
    /** Null clears the price: listed, not sold, until one is set (#913). */
    pricePaise: paise.nullable(),
    /** Compare-at price. */
    mrpPaise: paise.nullable(),
    costPaise: paise.nullable(),
    sku: z.string().trim().max(100).nullable(),
    barcode: z.string().trim().max(100).nullable(),
    weightGrams: z.number().int().min(0).max(1_000_000).nullable(),
    hsCode: z.string().trim().max(20).nullable(),
    /** Null uses the store's GST rate. */
    gstRatePercent: z.number().int().min(0).max(40).nullable(),
    /** false = always purchasable regardless of stock. */
    trackInventory: z.boolean(),
    /** ISO 3166-1 alpha-2, for customs. */
    countryOfOrigin: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/)
      .nullable(),
    packageLengthCm: z.number().int().min(1).max(200).nullable(),
    packageWidthCm: z.number().int().min(1).max(200).nullable(),
    packageHeightCm: z.number().int().min(1).max(200).nullable(),
    /** Only ever sent by undo: a custom box replaces the named box, and undo puts it back. */
    boxPresetId: z.string().trim().max(60).nullable(),
  })
  .partial()

export const BulkEditRowSchema = z.object({
  variantId: z.uuid(),
  product: BulkEditProductPatchSchema.optional(),
  variant: BulkEditVariantPatchSchema.optional(),
  /** Absolute on-hand count per location id. */
  stock: z.record(z.uuid(), z.number().int().min(0).max(1_000_000)).optional(),
})
export type BulkEditRow = z.infer<typeof BulkEditRowSchema>

export const BulkEditInputSchema = z.object({
  rows: z.array(BulkEditRowSchema).min(1).max(BULK_EDIT_MAX),
})

/** Which cell is wrong: `title`, `pricePaise`, `stock:<locationId>` and so on. */
export type BulkEditError = { variantId: string; field: string; message: string }

export type BulkEditResult =
  | { ok: false; errors: BulkEditError[] }
  | {
      ok: true
      updatedProducts: number
      updatedVariants: number
      stockChanges: number
      /** Rows that put every changed cell back; send them to the same procedure to undo. */
      undo: BulkEditRow[]
    }

/** HSN / SAC codes are 4 to 8 digits. */
export const HS_CODE_PATTERN = /^\d{4,8}$/
