import {
  addRegistration,
  BusinessInputSchema,
  BusinessUpdateSchema,
  cancelRegistration,
  createBusiness,
  GstRegistrationError,
  LocationOrderInputSchema,
  LocationPickupInputSchema,
  LocationRegistrationSchema,
  LocationSellingInputSchema,
  linkLocationRegistration,
  listBusinessGst,
  MaxParcelsInputSchema,
  permissions,
  RegistrationIdSchema,
  RegistrationInputSchema,
  RegistrationUpdateSchema,
  reorderLocations,
  setDefaultRegistration,
  setLocationCourierPickup,
  setLocationSelling,
  setMaxParcels,
  updateBusiness,
  updateRegistration,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { can } from '../procedures'

/**
 * A refusal the merchant can act on keeps its message and carries its code in `data.code`
 * (the admin offers "Add another business" on PAN_MISMATCH). Anything else is rethrown.
 */
async function refusing<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (err) {
    if (err instanceof GstRegistrationError) {
      throw new ORPCError(err.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST', {
        message: err.message,
        data: { code: err.code },
      })
    }
    throw err
  }
}

/** Settings › Business and GST: businesses (PANs), their GST numbers, and each location's GSTIN. */
export const businessGstRouter = {
  get: can(permissions.SETTINGS_READ).handler(({ context }) =>
    listBusinessGst(context.tx, context.scope.storeId),
  ),

  createBusiness: can(permissions.SETTINGS_MANAGE)
    .input(BusinessInputSchema)
    .handler(({ context, input }) =>
      refusing(() => createBusiness(context.tx, context.scope.storeId, input)),
    ),

  updateBusiness: can(permissions.SETTINGS_MANAGE)
    .input(BusinessUpdateSchema)
    .handler(({ context, input }) =>
      refusing(() => updateBusiness(context.tx, context.scope.storeId, input)),
    ),

  addRegistration: can(permissions.SETTINGS_MANAGE)
    .input(RegistrationInputSchema)
    .handler(({ context, input }) =>
      refusing(() => addRegistration(context.tx, context.scope.storeId, input)),
    ),

  updateRegistration: can(permissions.SETTINGS_MANAGE)
    .input(RegistrationUpdateSchema)
    .handler(({ context, input }) =>
      refusing(() => updateRegistration(context.tx, context.scope.storeId, input)),
    ),

  setDefault: can(permissions.SETTINGS_MANAGE)
    .input(RegistrationIdSchema)
    .handler(({ context, input }) =>
      refusing(() => setDefaultRegistration(context.tx, context.scope.storeId, input.id)),
    ),

  cancelRegistration: can(permissions.SETTINGS_MANAGE)
    .input(RegistrationIdSchema)
    .handler(({ context, input }) =>
      refusing(() => cancelRegistration(context.tx, context.scope.storeId, input.id)),
    ),

  linkLocation: can(permissions.SETTINGS_MANAGE)
    .input(LocationRegistrationSchema)
    .handler(({ context, input }) =>
      refusing(() => linkLocationRegistration(context.tx, context.scope.storeId, input)),
    ),

  /** Checkout routes online orders to this location, or not (the default always ships). */
  setLocationSelling: can(permissions.SETTINGS_MANAGE)
    .input(LocationSellingInputSchema)
    .handler(({ context, input }) =>
      refusing(() => setLocationSelling(context.tx, context.scope.storeId, input)),
    ),

  /** The order checkout tries locations in. */
  reorderLocations: can(permissions.SETTINGS_MANAGE)
    .input(LocationOrderInputSchema)
    .handler(({ context, input }) =>
      refusing(() => reorderLocations(context.tx, context.scope.storeId, input)),
    ),

  /** The most parcels one order may be split into. */
  setMaxParcels: can(permissions.SETTINGS_MANAGE)
    .input(MaxParcelsInputSchema)
    .handler(({ context, input }) => setMaxParcels(context.tx, context.scope.storeId, input)),

  /** Couriers collect from this location's address (Settings › Locations), or not. */
  setLocationPickup: can(permissions.SETTINGS_MANAGE)
    .input(LocationPickupInputSchema)
    .handler(({ context, input }) =>
      refusing(() => setLocationCourierPickup(context.tx, context.scope.storeId, input)),
    ),
}
