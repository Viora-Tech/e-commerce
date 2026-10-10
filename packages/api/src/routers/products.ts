import {
  BULK_EDIT_MAX,
  BulkEditInputSchema,
  bulkEdit,
  bulkUpdateProducts,
  createProduct,
  deleteProduct,
  duplicateProduct,
  exportRows,
  HandleSchema,
  InvalidProduct,
  importProducts,
  ProductStatusSchema,
  ProductWriteSchema,
  parseProductCsv,
  permissions,
  summariseImport,
  syncAutomaticCollections,
  uniqueHandle,
  updateProduct as writeProduct,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { BULK_MAX, can, heavy, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'
import { loadBulkEditSheet } from '../services/bulk-edit.service'
import {
  getProduct,
  listProductHandles,
  listProductIds,
  listProducts,
  pickProducts,
  productFacets,
  searchVariants,
  updateProduct,
  updateVariant,
} from '../services/product.service'
import { productAdjustments, productStats } from '../services/product-stats.service'

const ListFiltersSchema = z.object({
  search: z.string().trim().max(SEARCH_MAX).optional(),
  status: ProductStatusSchema.optional(),
  vendor: z.string().trim().max(100).optional(),
  productType: z.string().trim().max(100).optional(),
  tag: z.string().trim().max(50).optional(),
  stock: z.enum(['in', 'out', 'low']).optional(),
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

  get: can(permissions.PRODUCTS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getProduct(context.tx, input.id)),

  facets: can(permissions.PRODUCTS_READ).handler(({ context }) => productFacets(context.tx)),

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

  /** Variant picker for the draft order editor. */
  searchVariants: can(permissions.PRODUCTS_READ)
    .input(
      z.object({
        search: z.string().trim().max(SEARCH_MAX).optional(),
        limit: z.number().int().min(1).max(50).default(20),
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

  /** One action over many products: status, tags or delete. */
  bulk: can(permissions.PRODUCTS_WRITE)
    .use(heavy('bulk'))
    .input(
      z.object({
        ids: z.array(z.uuid()).min(1).max(BULK_MAX),
        action: z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('status'), status: ProductStatusSchema }),
          z.object({ kind: z.literal('addTag'), tag: z.string().trim().min(1).max(50) }),
          z.object({ kind: z.literal('removeTag'), tag: z.string().trim().min(1).max(50) }),
          z.object({ kind: z.literal('delete') }),
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
  bulkEdit: can(permissions.PRODUCTS_WRITE)
    .use(heavy('bulk'))
    .input(BulkEditInputSchema)
    .handler(({ context, input }) => {
      if (input.rows.some((r) => r.stock) && !context.scope.can(permissions.INVENTORY_WRITE)) {
        throw new ORPCError('FORBIDDEN', { message: 'Your role cannot change stock.' })
      }
      return bulkEdit(context.tx, context.scope.storeId, input.rows).then(async (result) => {
        /* A title, type, vendor, tag or price edit can move a product in or out of an automatic collection. */
        if (result.ok) await syncAutomaticCollections(context.tx, context.scope.storeId)
        return result
      })
    }),

  duplicate: can(permissions.PRODUCTS_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      invalidToBadRequest(async () => ({
        id: await duplicateProduct(context.tx, context.scope.storeId, input.id),
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
    .handler(({ context, input: { id, ...patch } }) => updateProduct(context.tx, id, patch)),

  updateVariant: can(permissions.INVENTORY_WRITE)
    .input(
      z.object({
        id: z.uuid(),
        pricePaise: z.number().int().min(0).optional(),
        mrpPaise: z.number().int().min(0).nullable().optional(),
        sku: z.string().max(100).nullable().optional(),
        onHand: z.number().int().min(0).optional(),
      }),
    )
    .handler(({ context, input: { id, ...patch } }) => updateVariant(context.tx, id, patch)),
}
