import {
  BULK_EDIT_MAX,
  BulkEditInputSchema,
  bulkEdit,
  bulkUpdateProducts,
  CommerceError,
  createProduct,
  deleteProduct,
  duplicateProduct,
  exportRows,
  HandleSchema,
  InvalidProduct,
  importProducts,
  PRODUCT_MISSING_FILTERS,
  ProductStatusSchema,
  ProductWriteSchema,
  parseProductCsv,
  permissions,
  removeVariantsById,
  STOCK_FILTERS,
  setVariantMedia,
  summariseImport,
  syncAutomaticCollections,
  uniqueHandle,
  VARIANT_MEDIA_MAX,
  updateProduct as writeProduct,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { BULK_MAX, can, heavy, inputField, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'
import { loadBulkEditSheet } from '../services/bulk-edit.service'
import {
  getProduct,
  listProductHandles,
  listProductIds,
  listProducts,
  productFacets,
  updateProduct,
  updateVariant,
} from '../services/product.service'
import { pickProducts, searchVariants } from '../services/product-picker.service'
import { productSales } from '../services/product-sales.service'
import { productAdjustments, productStats } from '../services/product-stats.service'

const ListFiltersSchema = z.object({
  search: z.string().trim().max(SEARCH_MAX).optional(),
  status: ProductStatusSchema.optional(),
  vendor: z.string().trim().max(100).optional(),
  productType: z.string().trim().max(100).optional(),
  tag: z.string().trim().max(50).optional(),
  stock: z.enum(STOCK_FILTERS).optional(),
  /** A live variant has no weight, or the product has no image (Store health's links). */
  missing: z.enum(PRODUCT_MISSING_FILTERS).optional(),
  /** Any of these (the admin's multi-pick filters); the single fields above still work. */
  vendors: z.array(z.string().trim().max(100)).max(50).optional(),
  productTypes: z.array(z.string().trim().max(100)).max(50).optional(),
  tags: z.array(z.string().trim().max(50)).max(50).optional(),
  /** In any of these collections. */
  collectionIds: z.array(z.uuid()).max(50).optional(),
  /** Some live variant is priced in this range (paise, both ends included). */
  priceMinPaise: z.number().int().min(0).optional(),
  priceMaxPaise: z.number().int().min(0).optional(),
  /** Created in [from, to). */
  createdFrom: z.iso.datetime().optional(),
  createdTo: z.iso.datetime().optional(),
  /** Exactly these products, e.g. the ones a discount already covers. */
  ids: z.array(z.uuid()).max(PAGE_SIZE_MAX).optional(),
})

async function invalidToBadRequest<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof InvalidProduct) {
      throw new ORPCError('BAD_REQUEST', { message: err.errors.join('. ') })
    }
    throw err
  }
}

export const productsRouter = {
  list: can(permissions.PRODUCTS_READ)
    .input(
      ListFiltersSchema.extend({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
      }),
    )
    .handler(({ context, input }) => listProducts(context.tx, input)),

  /** Tiles above the list. */
  stats: can(permissions.PRODUCTS_READ).handler(({ context }) => productStats(context.tx)),

  /** Stock movements for the product form's inventory history. */
  adjustments: can(permissions.INVENTORY_READ)
    .input(z.object({ productId: z.uuid(), limit: z.number().int().min(1).max(100).default(20) }))
    .handler(({ context, input }) => productAdjustments(context.tx, input.productId, input.limit)),

  /** "Sales past 90 days" on the product page (#56): units, buyers and net revenue. */
  sales: can(permissions.ORDERS_READ)
    .input(z.object({ productId: z.uuid() }))
    .handler(({ context, input }) => productSales(context.tx, input.productId)),

  get: can(permissions.PRODUCTS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getProduct(context.tx, input.id)),

  facets: can(permissions.PRODUCTS_READ).handler(({ context }) =>
    productFacets(context.tx, context.scope.storeId),
  ),

  /** Rows for the shared "Select products" dialog, variants included. */
  pick: can(permissions.PRODUCTS_READ)
    .input(
      z.object({
        search: z.string().trim().max(SEARCH_MAX).optional(),
        collectionId: z.uuid().optional(),
        productType: z.string().trim().max(100).optional(),
        status: ProductStatusSchema.optional(),
        limit: z.number().int().min(1).max(50).default(30),
      }),
    )
    .handler(({ context, input }) => pickProducts(context.tx, input)),

  /** Variant picker for the draft order editor and combo deals. */
  searchVariants: can(permissions.PRODUCTS_READ)
    .input(
      z.object({
        search: z.string().trim().max(SEARCH_MAX).optional(),
        limit: z.number().int().min(1).max(50).default(20),
        /** Only these variants (a saved combo deal's picks). */
        ids: z.array(z.uuid()).max(50).optional(),
      }),
    )
    .handler(({ context, input }) => searchVariants(context.tx, input)),

  /** Full write from the product form: options, variants and inventory in one transaction. */
  save: can(permissions.PRODUCTS_WRITE)
    .input(ProductWriteSchema.extend({ id: z.uuid().optional() }))
    .handler(({ context, input: { id, ...write } }) =>
      invalidToBadRequest(async () => {
        const productId = id
          ? await writeProduct(context.tx, context.scope.storeId, id, write)
          : await createProduct(context.tx, context.scope.storeId, write)
        /* A title, type, vendor, tag or price edit can move the product in or
           out of an automatic collection, so membership is recomputed here. */
        await syncAutomaticCollections(context.tx, context.scope.storeId)
        return getProduct(context.tx, productId)
      }),
    ),

  delete: can(permissions.PRODUCTS_DELETE)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const existing = await getProduct(context.tx, input.id)
      if (!existing) throw new ORPCError('NOT_FOUND', { message: 'Product not found' })
      return { outcome: await deleteProduct(context.tx, input.id) }
    }),

  /**
   * One action over many products: status, tags or delete. Deleting needs products.delete (and
   * its "Needs approval" tick), as deleting one product does.
   */
  bulk: can(permissions.PRODUCTS_WRITE, (input) =>
    inputField(inputField(input, 'action'), 'kind') === 'delete'
      ? [permissions.PRODUCTS_DELETE]
      : [],
  )
    .use(heavy('bulk'))
    .input(
      z.object({
        ids: z.array(z.uuid()).min(1).max(BULK_MAX),
        action: z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('status'), status: ProductStatusSchema }),
          z.object({ kind: z.literal('addTag'), tag: z.string().trim().min(1).max(50) }),
          z.object({ kind: z.literal('removeTag'), tag: z.string().trim().min(1).max(50) }),
          z.object({ kind: z.literal('delete') }),
          /* "Set weight and box": the products' own weight (packing comes from the box) and box,
             on every live variant, or only those with one option value ("XL"). */
          z.object({
            kind: z.literal('shipping'),
            weightGrams: z.number().int().min(1).max(100_000).optional(),
            boxPresetId: z.string().min(1).max(60).nullable().optional(),
            optionValue: z.string().trim().min(1).max(60).optional(),
          }),
        ]),
      }),
    )
    .handler(({ context, input }) => bulkUpdateProducts(context.tx, input.ids, input.action)),

  /** The bulk editor's sheet: every live variant of the chosen products, with stock per location. */
  bulkEditSheet: can(permissions.PRODUCTS_READ)
    .input(z.object({ ids: z.array(z.uuid()).min(1).max(BULK_EDIT_MAX) }))
    .handler(({ context, input }) => loadBulkEditSheet(context.tx, input.ids)),

  /**
   * One save for the whole sheet: every row is checked first, then all of it is written in one
   * transaction, or none of it, with per-row errors. Stock cells also need inventory access.
   */
  bulkEdit: can(permissions.PRODUCTS_WRITE, (input) => {
    const rows = inputField(input, 'rows')
    return Array.isArray(rows) && rows.some((r) => inputField(r, 'stock'))
      ? [permissions.INVENTORY_WRITE]
      : []
  })
    .use(heavy('bulk'))
    .input(BulkEditInputSchema)
    .handler(({ context, input }) => {
      return bulkEdit(context.tx, context.scope.storeId, input.rows, {
        stockReason: input.stockReason,
      }).then(async (result) => {
        /* A title, type, vendor, tag or price edit can move a product in or out of an automatic collection. */
        if (result.ok) await syncAutomaticCollections(context.tx, context.scope.storeId)
        return result
      })
    }),

  /** The bulk editor's "Delete variants": archived when history points at them, else deleted. */
  removeVariants: can(permissions.PRODUCTS_WRITE)
    .input(z.object({ ids: z.array(z.uuid()).min(1).max(BULK_EDIT_MAX) }))
    .handler(async ({ context, input }) => {
      const result = await removeVariantsById(context.tx, input.ids)
      if (result.ok) await syncAutomaticCollections(context.tx, context.scope.storeId)
      return result
    }),

  duplicate: can(permissions.PRODUCTS_WRITE)
    .input(
      z.object({
        id: z.uuid(),
        /** What to copy besides text and prices (audit #136): photos on, stock off by default. */
        photos: z.boolean().default(true),
        stock: z.boolean().default(false),
      }),
    )
    .handler(({ context, input }) =>
      invalidToBadRequest(async () => ({
        id: await duplicateProduct(context.tx, context.scope.storeId, input.id, {
          photos: input.photos,
          stock: input.stock,
        }),
      })),
    ),

  /** Rows for the CSV the browser downloads, honouring the current filter. */
  exportRows: can(permissions.PRODUCTS_READ)
    .use(heavy('export'))
    .input(ListFiltersSchema)
    .handler(async ({ context, input }) =>
      exportRows(context.tx, await listProductIds(context.tx, { ...input, page: 1, perPage: 1 })),
    ),

  /** Dry run: parse the file and say what would change, writing nothing. */
  previewImport: can(permissions.PRODUCTS_IMPORT)
    .use(heavy('import'))
    .input(z.object({ csv: z.string().min(1).max(8_000_000) }))
    .handler(async ({ context, input }) => {
      const parsed = parseProductCsv(input.csv)
      const handles = await listProductHandles(context.tx)
      return {
        summary: summariseImport(parsed, handles),
        issues: parsed.issues.slice(0, 50),
        ignoredColumns: parsed.ignoredColumns,
        sample: parsed.products.slice(0, 5).map((p) => ({
          handle: p.handle,
          title: p.title,
          variants: p.variants.length,
          exists: handles.includes(p.handle),
        })),
      }
    }),

  import: can(permissions.PRODUCTS_IMPORT)
    .use(heavy('import'))
    .input(z.object({ csv: z.string().min(1).max(8_000_000) }))
    .handler(({ context, input }) =>
      invalidToBadRequest(() =>
        importProducts(context.tx, context.scope.storeId, parseProductCsv(input.csv).products).then(
          async (result) => {
            await syncAutomaticCollections(context.tx, context.scope.storeId)
            return result
          },
        ),
      ),
    ),

  generateHandle: can(permissions.PRODUCTS_READ)
    .input(z.object({ title: z.string().trim().min(1).max(200), exceptId: z.uuid().optional() }))
    .handler(async ({ context, input }) => ({
      handle: await uniqueHandle(context.tx, input.title, input.exceptId),
    })),

  /** Small patches from the list page (bulk status). The form uses `save`. */
  update: can(permissions.PRODUCTS_WRITE)
    .input(
      z.object({
        id: z.uuid(),
        title: z.string().trim().min(1).max(200).optional(),
        handle: HandleSchema.optional(),
        vendor: z.string().max(100).nullable().optional(),
        productType: z.string().max(100).nullable().optional(),
        status: ProductStatusSchema.optional(),
      }),
    )
    .handler(({ context, input: { id, ...patch } }) =>
      updateProduct(context.tx, context.scope.storeId, id, patch),
    ),

  /**
   * Set one variant's images in order (first = the variant's main image); a file not yet in the
   * product's gallery is added to it. An empty list clears them.
   */
  setVariantImages: can(permissions.PRODUCTS_WRITE)
    .input(
      z.object({
        variantId: z.uuid(),
        mediaIds: z.array(z.uuid()).max(VARIANT_MEDIA_MAX),
      }),
    )
    .handler(async ({ context, input }) => {
      try {
        return await setVariantMedia(
          context.tx,
          context.scope.storeId,
          input.variantId,
          input.mediaIds,
        )
      } catch (err) {
        if (err instanceof CommerceError) {
          const code = err.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST'
          throw new ORPCError(code, { message: err.message })
        }
        throw err
      }
    }),

  /**
   * Patch one variant: price, MRP, SKU, stock, hide it on the storefront (`hiddenOnStore`), or
   * say whether it is a physical product (`requiresShipping`).
   */
  updateVariant: can(permissions.INVENTORY_WRITE)
    .input(
      z.object({
        id: z.uuid(),
        pricePaise: z.number().int().min(0).optional(),
        mrpPaise: z.number().int().min(0).nullable().optional(),
        sku: z.string().max(100).nullable().optional(),
        /** Oversold (pre-orders) is below zero; saving the row as it is must still work. */
        onHand: z.number().int().min(-1_000_000).optional(),
        /** Hidden variants are never shown or sold on the storefront, but stay in admin (#934). */
        hiddenOnStore: z.boolean().optional(),
        /** Shopify's "This is a physical product": false takes no shipping and never ships. */
        requiresShipping: z.boolean().optional(),
      }),
    )
    .handler(({ context, input: { id, ...patch } }) => updateVariant(context.tx, id, patch)),
}
