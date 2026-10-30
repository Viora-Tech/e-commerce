import {
  CatalogCreateSchema,
  CatalogError,
  CatalogIdSchema,
  CatalogUpdateSchema,
  createCatalog,
  deleteCatalog,
  getCatalog,
  listCatalogs,
  permissions,
  updateCatalog,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { can } from '../procedures'

type Ctx = { scope: { storeId: string }; tx: StoreTx }
const ctxOf = (context: Ctx) => ({ storeId: context.scope.storeId, tx: context.tx })

/** A refused catalog change as its HTTP error, keeping the words the admin shows. */
async function catalogErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof CatalogError) {
      throw new ORPCError(err.code === 'CATALOG_NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST', {
        message: err.message,
      })
    }
    throw err
  }
}

const read = () => can(permissions.SETTINGS_READ)
const manage = () => can(permissions.SETTINGS_MANAGE)

/** Markets › Catalogs: which products each market sells and at what prices. */
export const catalogsRouter = {
  /** Every catalog with its product count, price change and markets. */
  list: read().handler(({ context }) => listCatalogs(ctxOf(context))),

  /** One catalog with its chosen products, collections and fixed prices. */
  get: read()
    .input(CatalogIdSchema)
    .handler(({ context, input }) => catalogErrors(() => getCatalog(ctxOf(context), input.id))),

  /** Add a catalog: its products, price change and the markets that sell from it. */
  create: manage()
    .input(CatalogCreateSchema)
    .handler(({ context, input }) => catalogErrors(() => createCatalog(ctxOf(context), input))),

  /** Change a catalog; only the parts sent are replaced. */
  update: manage()
    .input(CatalogUpdateSchema)
    .handler(({ context, input }) => catalogErrors(() => updateCatalog(ctxOf(context), input))),

  /** Delete a catalog; its markets sell every product at their own prices again. */
  delete: manage()
    .input(CatalogIdSchema)
    .handler(async ({ context, input }) => {
      await catalogErrors(() => deleteCatalog(ctxOf(context), input.id))
      return { ok: true as const }
    }),
}
