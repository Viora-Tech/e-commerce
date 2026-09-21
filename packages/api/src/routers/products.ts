import {
  createProduct,
  deleteProduct,
  HandleSchema,
  InvalidProduct,
  ProductStatusSchema,
  ProductWriteSchema,
  uniqueHandle,
  updateProduct as writeProduct,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { storeProcedure } from '../procedures'
import {
  getProduct,
  listProducts,
  productFacets,
  updateProduct,
  updateVariant,
} from '../services/product.service'

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
  list: storeProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(25),
        search: z.string().trim().max(200).optional(),
        status: ProductStatusSchema.optional(),
      }),
    )
    .handler(({ context, input }) => listProducts(context.tx, input)),

  get: storeProcedure
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getProduct(context.tx, input.id)),

  facets: storeProcedure.handler(({ context }) => productFacets(context.tx)),

  /** Full write from the product form: options, variants and inventory in one transaction. */
  save: storeProcedure
    .input(ProductWriteSchema.extend({ id: z.uuid().optional() }))
    .handler(({ context, input: { id, ...write } }) =>
      invalidToBadRequest(async () => {
        const productId = id
          ? await writeProduct(context.tx, context.scope.storeId, id, write)
          : await createProduct(context.tx, context.scope.storeId, write)
        return getProduct(context.tx, productId)
      }),
    ),

  delete: storeProcedure.input(z.object({ id: z.uuid() })).handler(async ({ context, input }) => {
    const existing = await getProduct(context.tx, input.id)
    if (!existing) throw new ORPCError('NOT_FOUND', { message: 'Product not found' })
    return { outcome: await deleteProduct(context.tx, input.id) }
  }),

  generateHandle: storeProcedure
    .input(z.object({ title: z.string().trim().min(1).max(200), exceptId: z.uuid().optional() }))
    .handler(async ({ context, input }) => ({
      handle: await uniqueHandle(context.tx, input.title, input.exceptId),
    })),

  /** Small patches from the list page (bulk status). The form uses `save`. */
  update: storeProcedure
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

  updateVariant: storeProcedure
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
