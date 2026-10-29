import { settingsSecret } from '@commerce/config'
import {
  adjustStock,
  BulkStockEditSchema,
  bulkAdjustStock,
  cancelPurchaseOrder,
  closePurchaseOrder,
  createLocation,
  deletePurchaseOrder,
  deleteTransfer,
  EmailPurchaseOrderSchema,
  emailPurchaseOrder,
  InventoryError,
  LocationInputSchema,
  LocationUpdateSchema,
  listLocations,
  loadPurchaseOrderSheet,
  markOrdered,
  PURCHASE_ORDER_STATUSES,
  PurchaseOrderInputSchema,
  permissions,
  poFilename,
  ReceiptSchema,
  receivePurchaseOrder,
  receiveTransfer,
  reopenPurchaseOrder,
  STOCK_FILTERS,
  StockEditSchema,
  savePurchaseOrder,
  saveTransfer,
  setStock,
  shipTransfer,
  storeNotificationChannels,
  TransferInputSchema,
  updateLocation,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { renderPurchaseOrderToBuffer } from '@commerce/invoices/render'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, heavy, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import {
  inventoryFacets,
  inventoryHistory,
  inventoryStats,
  listInventory,
  STOCK_CHANGED_FILTERS,
  searchVariants,
} from '../services/inventory.service'
import { previewCosts } from '../services/landed-cost.service'
import {
  getPurchaseOrder,
  listPurchaseOrders,
  purchaseOrderCounts,
} from '../services/purchase-order.service'
import { getTransfer, listTransfers } from '../services/transfer.service'

/** Stock rules the merchant broke (negative stock, wrong status) come back as 400s. */
export async function friendly<T>(fn: () => Promise<T>): Promise<T> {
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
  search: z.string().trim().max(SEARCH_MAX).optional(),
  stock: z.enum(['all', ...STOCK_FILTERS]).optional(),
  vendor: z.string().max(200).optional(),
  productType: z.string().max(200).optional(),
  /** Any of these (the admin's multi-pick filters); the single fields above still work. */
  vendors: z.array(z.string().max(200)).max(50).optional(),
  productTypes: z.array(z.string().max(200)).max(50).optional(),
  tags: z.array(z.string().max(50)).max(50).optional(),
  collectionIds: z.array(z.uuid()).max(50).optional(),
  productStatus: z
    .array(z.enum(['active', 'draft']))
    .max(2)
    .optional(),
  changed: z.enum(STOCK_CHANGED_FILTERS).optional(),
  group: z.enum(['variant', 'product']).optional(),
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

  /** Name, address and phone of an existing location; "Bills under" follows a new state. */
  updateLocation: can(permissions.INVENTORY_WRITE)
    .input(LocationUpdateSchema)
    .handler(({ context, input }) =>
      friendly(() => updateLocation(context.tx, context.scope.storeId, input)),
    ),

  stats: can(permissions.INVENTORY_READ)
    .input(z.object({ locationId: z.uuid() }))
    .handler(({ context, input }) => inventoryStats(context.tx, input.locationId)),

  facets: can(permissions.INVENTORY_READ).handler(({ context }) => inventoryFacets(context.tx)),

  list: can(permissions.INVENTORY_READ)
    .input(listInput)
    .handler(({ context, input }) => listInventory(context.tx, input)),

  /** Every matching row, for CSV export. Capped so one request stays small. */
  exportRows: can(permissions.INVENTORY_READ)
    .use(heavy('export'))
    .input(listInput.omit({ page: true, perPage: true }))
    .handler(async ({ context, input }) => {
      // Always by SKU: the cap stays 5000 lines, and SKU order already keeps a product together.
      const { rows } = await listInventory(context.tx, {
        ...input,
        group: 'variant',
        page: 1,
        perPage: 5000,
      })
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
    .use(heavy('bulk'))
    .input(BulkStockEditSchema)
    .handler(({ context, input }) =>
      friendly(async () => {
        const { variantIds, ...edit } = input
        if (edit.mode === 'adjust') {
          const updated = await bulkAdjustStock(context.tx, {
            storeId: context.scope.storeId,
            locationId: edit.locationId,
            variantIds,
            delta: edit.value,
            reason: edit.reason,
            note: edit.note,
          })
          return { updated }
        }
        for (const variantId of variantIds) {
          await applyEdit(context.tx, context.scope.storeId, { ...edit, variantId })
        }
        return { updated: variantIds.length }
      }),
    ),

  searchVariants: can(permissions.PRODUCTS_READ)
    .input(
      z.object({
        search: z.string().trim().max(SEARCH_MAX).optional(),
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
        status: z.enum(['all', ...PURCHASE_ORDER_STATUSES]).optional(),
        search: z.string().trim().max(SEARCH_MAX).optional(),
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
      }),
    )
    .handler(({ context, input }) => listPurchaseOrders(context.tx, input)),

  get: can(permissions.INVENTORY_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const po = await getPurchaseOrder(context.tx, input.id)
      if (!po) throw new ORPCError('NOT_FOUND', { message: 'This purchase order was not found' })
      return po
    }),

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
      friendly(() =>
        receivePurchaseOrder(context.tx, context.scope.storeId, input, context.scope.userId),
      ),
    ),

  close: can(permissions.INVENTORY_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      friendly(() => closePurchaseOrder(context.tx, context.scope.storeId, input.id)),
    ),

  /** Call off a draft or an order nothing has arrived on. */
  cancel: can(permissions.INVENTORY_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      friendly(() => cancelPurchaseOrder(context.tx, context.scope.storeId, input.id)),
    ),

  /** Undo a close or a cancel. */
  reopen: can(permissions.INVENTORY_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      friendly(() => reopenPurchaseOrder(context.tx, context.scope.storeId, input.id)),
    ),

  /** Charges, their splits and each line's landed cost for this order and its shipment. No writes. */
  costs: can(permissions.INVENTORY_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      friendly(() =>
        previewCosts(context.tx, context.scope.storeId, { purchaseOrderId: input.id }),
      ),
    ),

  delete: can(permissions.INVENTORY_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      friendly(() => deletePurchaseOrder(context.tx, context.scope.storeId, input.id)),
    ),

  /** The purchase order as a PDF for the supplier: print it or save it. */
  pdf: can(permissions.INVENTORY_READ)
    .use(heavy('bulk'))
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      friendly(async () => {
        const sheet = await loadPurchaseOrderSheet(context.tx, context.scope.storeId, input.id)
        const bytes = await renderPurchaseOrderToBuffer(sheet)
        return new File([bytes as Uint8Array<ArrayBuffer>], poFilename(sheet.number), {
          type: 'application/pdf',
        })
      }),
    ),

  /** Email the PDF to the supplier through the store's sender email; optionally mark a draft ordered. */
  email: can(permissions.INVENTORY_WRITE)
    .use(heavy('bulk'))
    .input(EmailPurchaseOrderSchema)
    .handler(({ context, input }) =>
      friendly(async () => {
        const { storeId } = context.scope
        const { notifications } = await storeRegistries(context.tx, storeId)
        const channels = await storeNotificationChannels(context.tx, storeId, {
          registry: notifications,
          settingsSecret: settingsSecret(),
        })
        return emailPurchaseOrder(context.tx, storeId, input, {
          channels,
          renderPdf: renderPurchaseOrderToBuffer,
        })
      }),
    ),
}

export const transfersRouter = {
  list: can(permissions.INVENTORY_READ)
    .input(
      z.object({
        status: z.enum(['all', 'draft', 'in_transit', 'received']).optional(),
        search: z.string().trim().max(SEARCH_MAX).optional(),
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
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
