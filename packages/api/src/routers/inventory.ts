import {
  adjustStock,
  BulkStockEditSchema,
  closePurchaseOrder,
  createLocation,
  deletePurchaseOrder,
  deleteTransfer,
  InventoryError,
  LocationInputSchema,
  listLocations,
  markOrdered,
  PurchaseOrderInputSchema,
  permissions,
  ReceiptSchema,
  receivePurchaseOrder,
  receiveTransfer,
  StockEditSchema,
  savePurchaseOrder,
  saveTransfer,
  setStock,
  shipTransfer,
  TransferInputSchema,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import {
  inventoryFacets,
  inventoryHistory,
  inventoryStats,
  listInventory,
  searchVariants,
} from '../services/inventory.service'
import {
  getPurchaseOrder,
  listPurchaseOrders,
  purchaseOrderCounts,
} from '../services/purchase-order.service'
import { getTransfer, listTransfers } from '../services/transfer.service'

/** Stock rules the merchant broke (negative stock, wrong status) come back as 400s. */
async function friendly<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof InventoryError) {
      throw new ORPCError('BAD_REQUEST', { message: err.message, data: { code: err.code } })
    }
    throw err
  }
}

const listInput = z.object({
  locationId: z.uuid(),
  search: z.string().trim().max(200).optional(),
  stock: z.enum(['all', 'in', 'low', 'out']).optional(),
  vendor: z.string().max(200).optional(),
  productType: z.string().max(200).optional(),
  sort: z.enum(['product', 'available_asc', 'available_desc']).optional(),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(250).default(25),
})

async function applyEdit(
  tx: StoreTx,
  storeId: string,
  edit: { variantId: string; locationId: string; mode: 'adjust' | 'set'; value: number } & {
    reason: z.infer<typeof StockEditSchema>['reason']
    note?: string | undefined
  },
) {
  const common = {
    storeId,
    variantId: edit.variantId,
    locationId: edit.locationId,
    reason: edit.reason,
    note: edit.note,
  }
  return edit.mode === 'set'
    ? setStock(tx, { ...common, onHand: edit.value })
    : adjustStock(tx, { ...common, delta: edit.value })
}

export const inventoryRouter = {
  locations: can(permissions.INVENTORY_READ).handler(({ context }) =>
    listLocations(context.tx, context.scope.storeId),
  ),

  createLocation: can(permissions.INVENTORY_WRITE)
    .input(LocationInputSchema)
    .handler(({ context, input }) => createLocation(context.tx, context.scope.storeId, input)),

  stats: can(permissions.INVENTORY_READ)
    .input(z.object({ locationId: z.uuid() }))
    .handler(({ context, input }) => inventoryStats(context.tx, input.locationId)),

  facets: can(permissions.INVENTORY_READ).handler(({ context }) => inventoryFacets(context.tx)),

  list: can(permissions.INVENTORY_READ)
    .input(listInput)
    .handler(({ context, input }) => listInventory(context.tx, input)),

  /** Every matching row, for CSV export. Capped so one request stays small. */
  exportRows: can(permissions.INVENTORY_READ)
    .input(listInput.omit({ page: true, perPage: true }))
    .handler(async ({ context, input }) => {
      const { rows } = await listInventory(context.tx, { ...input, page: 1, perPage: 5000 })
      return rows
    }),

  history: can(permissions.INVENTORY_READ)
    .input(z.object({ variantId: z.uuid(), locationId: z.uuid().optional() }))
    .handler(({ context, input }) =>
      inventoryHistory(context.tx, input.variantId, input.locationId),
    ),

  /** One inline edit: returns the new on-hand count. */
  edit: can(permissions.INVENTORY_WRITE)
    .input(StockEditSchema)
    .handler(({ context, input }) =>
      friendly(() => applyEdit(context.tx, context.scope.storeId, input)),
    ),

  /** Same edit across selected rows; all or nothing. */
  bulkEdit: can(permissions.INVENTORY_WRITE)
    .input(BulkStockEditSchema)
    .handler(({ context, input }) =>
      friendly(async () => {
        const { variantIds, ...edit } = input
        for (const variantId of variantIds) {
          await applyEdit(context.tx, context.scope.storeId, { ...edit, variantId })
        }
        return { updated: variantIds.length }
      }),
    ),

  searchVariants: can(permissions.PRODUCTS_READ)
    .input(
      z.object({
        search: z.string().trim().max(200).optional(),
        locationId: z.uuid().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .handler(({ context, input }) => searchVariants(context.tx, input)),
}

export const purchaseOrdersRouter = {
  counts: can(permissions.INVENTORY_READ).handler(({ context }) => purchaseOrderCounts(context.tx)),

  list: can(permissions.INVENTORY_READ)
    .input(
      z.object({
        status: z
          .enum(['all', 'draft', 'ordered', 'partially_received', 'received', 'closed'])
          .optional(),
        search: z.string().trim().max(200).optional(),
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(25),
      }),
    )
    .handler(({ context, input }) => listPurchaseOrders(context.tx, input)),

  get: can(permissions.INVENTORY_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getPurchaseOrder(context.tx, input.id)),

  save: can(permissions.INVENTORY_WRITE)
    .input(PurchaseOrderInputSchema)
    .handler(({ context, input }) =>
      friendly(() => savePurchaseOrder(context.tx, context.scope.storeId, input)),
    ),

  markOrdered: can(permissions.INVENTORY_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      friendly(() => markOrdered(context.tx, context.scope.storeId, input.id)),
    ),

  receive: can(permissions.INVENTORY_WRITE)
    .input(ReceiptSchema)
    .handler(({ context, input }) =>
      friendly(() => receivePurchaseOrder(context.tx, context.scope.storeId, input)),
    ),

  close: can(permissions.INVENTORY_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      friendly(() => closePurchaseOrder(context.tx, context.scope.storeId, input.id)),
    ),

  delete: can(permissions.INVENTORY_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      friendly(() => deletePurchaseOrder(context.tx, context.scope.storeId, input.id)),
    ),
}

export const transfersRouter = {
  list: can(permissions.INVENTORY_READ)
    .input(
      z.object({
        status: z.enum(['all', 'draft', 'in_transit', 'received']).optional(),
        search: z.string().trim().max(200).optional(),
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(25),
      }),
    )
    .handler(({ context, input }) => listTransfers(context.tx, input)),

  get: can(permissions.INVENTORY_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getTransfer(context.tx, input.id)),

  save: can(permissions.INVENTORY_WRITE)
    .input(TransferInputSchema)
    .handler(({ context, input }) =>
      friendly(() => saveTransfer(context.tx, context.scope.storeId, input)),
    ),

  ship: can(permissions.INVENTORY_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      friendly(() => shipTransfer(context.tx, context.scope.storeId, input.id)),
    ),

  receive: can(permissions.INVENTORY_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      friendly(() => receiveTransfer(context.tx, context.scope.storeId, input.id)),
    ),

  delete: can(permissions.INVENTORY_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      friendly(() => deleteTransfer(context.tx, context.scope.storeId, input.id)),
    ),
}
