import {
  CollectionRulesSchema,
  CollectionWriteSchema,
  collectionsForProducts,
  createCollection,
  deleteCollection,
  InvalidCollection,
  permissions,
  previewRules,
  reorderCollection,
  setProductCollections,
  updateCollection,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import {
  collectionStats,
  getCollection,
  listCollectionProducts,
  listCollections,
  searchProducts,
} from '../services/collection.service'

async function invalidToBadRequest<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof InvalidCollection) {
      throw new ORPCError('BAD_REQUEST', { message: err.errors.join('. ') })
    }
    throw err
  }
}

export const collectionsRouter = {
  list: can(permissions.PRODUCTS_READ).handler(({ context }) => listCollections(context.tx)),

  /** Tiles above the category cards. */
  stats: can(permissions.PRODUCTS_READ).handler(({ context }) => collectionStats(context.tx)),

  get: can(permissions.PRODUCTS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getCollection(context.tx, input.id)),

  /** The frame's table: every product, or only those in one collection. */
  products: can(permissions.PRODUCTS_READ)
    .input(
      z.object({
        collectionId: z.uuid().optional(),
        search: z.string().trim().max(200).optional(),
        tab: z.enum(['all', 'featured', 'onSale', 'outOfStock']).optional(),
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(10),
      }),
    )
    .handler(({ context, input }) => listCollectionProducts(context.tx, input)),

  /** Product picker inside a manual collection. */
  searchProducts: can(permissions.PRODUCTS_READ)
    .input(
      z.object({
        search: z.string().trim().max(200).default(''),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .handler(({ context, input }) => searchProducts(context.tx, input.search, input.limit)),

  /** Live "matches N products" while the merchant writes rules. */
  preview: can(permissions.PRODUCTS_READ)
    .input(z.object({ rules: CollectionRulesSchema }))
    .handler(({ context, input }) => previewRules(context.tx, input.rules)),

  create: can(permissions.PRODUCTS_WRITE)
    .input(CollectionWriteSchema)
    .handler(({ context, input }) =>
      invalidToBadRequest(async () => ({
        id: await createCollection(context.tx, context.scope.storeId, input),
      })),
    ),

  update: can(permissions.PRODUCTS_WRITE)
    .input(z.object({ id: z.uuid(), write: CollectionWriteSchema }))
    .handler(({ context, input }) =>
      invalidToBadRequest(async () => {
        await updateCollection(context.tx, context.scope.storeId, input.id, input.write)
        return { ok: true as const }
      }),
    ),

  reorder: can(permissions.PRODUCTS_WRITE)
    .input(z.object({ id: z.uuid(), productIds: z.array(z.uuid()).max(500) }))
    .handler(async ({ context, input }) => {
      await reorderCollection(context.tx, input.id, input.productIds)
      return { ok: true as const }
    }),

  /** Manual collections a product sits in, for the product form's organisation card. */
  forProduct: can(permissions.PRODUCTS_READ)
    .input(z.object({ productId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const map = await collectionsForProducts(context.tx, [input.productId])
      return map.get(input.productId) ?? []
    }),

  setForProduct: can(permissions.PRODUCTS_WRITE)
    .input(z.object({ productId: z.uuid(), collectionIds: z.array(z.uuid()).max(100) }))
    .handler(async ({ context, input }) => {
      await setProductCollections(
        context.tx,
        context.scope.storeId,
        input.productId,
        input.collectionIds,
      )
      return { ok: true as const }
    }),

  delete: can(permissions.PRODUCTS_DELETE)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      await deleteCollection(context.tx, input.id)
      return { ok: true as const }
    }),
}
