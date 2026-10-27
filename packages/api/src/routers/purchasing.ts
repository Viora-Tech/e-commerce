import { settingsSecret } from '@commerce/config'
import {
  addPurchaseCharge,
  attachPurchaseOrder,
  deleteInboundShipment,
  deleteSupplier,
  detachPurchaseOrder,
  INBOUND_SHIPMENT_STATUSES,
  InboundShipmentInputSchema,
  PurchaseChargeInputSchema,
  PurchaseChargeUpdateSchema,
  permissions,
  removePurchaseCharge,
  SupplierInputSchema,
  saveInboundShipment,
  saveSupplier,
  updatePurchaseCharge,
} from '@commerce/core'
import { inboundTrackingCourier } from '@commerce/core/inventory'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import { refreshInboundTracking } from '../services/inbound-tracking.service'
import { previewCosts } from '../services/landed-cost.service'
import {
  getInboundShipment,
  getSupplier,
  listInboundShipments,
  listSuppliers,
} from '../services/purchasing.service'
import { friendly } from './inventory'

const page = {
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
}
const byId = z.object({ id: z.uuid() })

export const suppliersRouter = {
  list: can(permissions.INVENTORY_READ)
    .input(z.object({ search: z.string().trim().max(SEARCH_MAX).optional(), ...page }))
    .handler(({ context, input }) => listSuppliers(context.tx, input)),

  get: can(permissions.INVENTORY_READ)
    .input(byId)
    .handler(async ({ context, input }) => {
      const row = await getSupplier(context.tx, input.id)
      if (!row) throw new ORPCError('NOT_FOUND', { message: 'This supplier was not found' })
      return row
    }),

  save: can(permissions.INVENTORY_WRITE)
    .input(SupplierInputSchema)
    .handler(({ context, input }) =>
      friendly(() => saveSupplier(context.tx, context.scope.storeId, input)),
    ),

  delete: can(permissions.INVENTORY_WRITE)
    .input(byId)
    .handler(({ context, input }) =>
      friendly(() => deleteSupplier(context.tx, context.scope.storeId, input.id)),
    ),
}

export const inboundShipmentsRouter = {
  list: can(permissions.INVENTORY_READ)
    .input(
      z.object({
        status: z.enum(['all', ...INBOUND_SHIPMENT_STATUSES]).optional(),
        search: z.string().trim().max(SEARCH_MAX).optional(),
        ...page,
      }),
    )
    .handler(({ context, input }) => listInboundShipments(context.tx, input)),

  get: can(permissions.INVENTORY_READ)
    .input(byId)
    .handler(async ({ context, input }) => {
      const row = await getInboundShipment(context.tx, input.id)
      if (!row) {
        throw new ORPCError('NOT_FOUND', { message: 'This inbound shipment was not found' })
      }
      return row
    }),

  /** Shared charges, their splits across every order in it, and landed cost per line. */
  costs: can(permissions.INVENTORY_READ)
    .input(byId)
    .handler(({ context, input }) =>
      friendly(() =>
        previewCosts(context.tx, context.scope.storeId, { inboundShipmentId: input.id }),
      ),
    ),

  /** Saves; a new tracking number with a connected carrier also reads its expected date. */
  save: can(permissions.INVENTORY_WRITE)
    .input(InboundShipmentInputSchema)
    .handler(async ({ context, input }) => {
      const id = await friendly(() => saveInboundShipment(context.tx, context.scope.storeId, input))
      if (input.trackingNumber && inboundTrackingCourier(input.carrier)) {
        const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
        await refreshInboundTracking(
          context.tx,
          context.scope.storeId,
          shipping,
          settingsSecret(),
          id,
        )
      }
      return id
    }),

  /** Read the carrier's expected delivery date now (FedEx, DHL Express, … when connected). */
  track: can(permissions.INVENTORY_WRITE)
    .input(byId)
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return refreshInboundTracking(
        context.tx,
        context.scope.storeId,
        shipping,
        settingsSecret(),
        input.id,
      )
    }),

  delete: can(permissions.INVENTORY_WRITE)
    .input(byId)
    .handler(({ context, input }) =>
      friendly(() => deleteInboundShipment(context.tx, context.scope.storeId, input.id)),
    ),

  /** Put an order on this shipment (off any other); both are recosted. */
  attach: can(permissions.INVENTORY_WRITE)
    .input(z.object({ id: z.uuid(), purchaseOrderId: z.uuid() }))
    .handler(({ context, input }) =>
      friendly(() =>
        attachPurchaseOrder(context.tx, context.scope.storeId, input.id, input.purchaseOrderId),
      ),
    ),

  detach: can(permissions.INVENTORY_WRITE)
    .input(z.object({ purchaseOrderId: z.uuid() }))
    .handler(({ context, input }) =>
      friendly(() => detachPurchaseOrder(context.tx, context.scope.storeId, input.purchaseOrderId)),
    ),
}

/** Freight, customs, clearing and bank charges on an order or a shipment. Every change recosts. */
export const purchaseChargesRouter = {
  add: can(permissions.INVENTORY_WRITE)
    .input(PurchaseChargeInputSchema)
    .handler(({ context, input }) =>
      friendly(() => addPurchaseCharge(context.tx, context.scope.storeId, input)),
    ),

  update: can(permissions.INVENTORY_WRITE)
    .input(PurchaseChargeUpdateSchema)
    .handler(({ context, input }) =>
      friendly(() => updatePurchaseCharge(context.tx, context.scope.storeId, input)),
    ),

  remove: can(permissions.INVENTORY_WRITE)
    .input(byId)
    .handler(({ context, input }) =>
      friendly(() => removePurchaseCharge(context.tx, context.scope.storeId, input.id)),
    ),
}
