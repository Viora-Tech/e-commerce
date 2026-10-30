import {
  CommerceError,
  collectionProductIds,
  createShippingProfile,
  createShippingZone,
  deleteShippingProfile,
  deleteShippingZone,
  getShippingProfile,
  getShippingZone,
  listShippingProfiles,
  listShippingZones,
  permissions,
  ShippingProfileWriteSchema,
  ShippingZoneWriteSchema,
  updateShippingProfile,
  updateShippingZone,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'

const notFound = (err: unknown): never => {
  if (err instanceof CommerceError && err.code === 'NOT_FOUND') {
    throw new ORPCError('NOT_FOUND', { message: err.message })
  }
  throw err
}

/**
 * Settings → Shipping → Shipping rates: shipping profiles (General and custom ones with
 * their products), their zones (states and PIN code rules) and the rates offered in each.
 * Guarded like the rest of the shipping settings: read with `settings.read`, change with
 * `settings.manage`.
 */
export const shippingRouter = {
  profiles: {
    list: can(permissions.SETTINGS_READ).handler(({ context }) =>
      listShippingProfiles(context.tx, context.scope.storeId),
    ),

    get: can(permissions.SETTINGS_READ)
      .input(z.object({ id: z.uuid() }))
      .handler(({ context, input }) =>
        getShippingProfile(context.tx, context.scope.storeId, input.id),
      ),

    create: can(permissions.SETTINGS_MANAGE)
      .input(ShippingProfileWriteSchema)
      .handler(({ context, input }) =>
        createShippingProfile(context.tx, context.scope.storeId, input),
      ),

    update: can(permissions.SETTINGS_MANAGE)
      .input(z.object({ id: z.uuid(), data: ShippingProfileWriteSchema }))
      .handler(({ context, input }) =>
        updateShippingProfile(context.tx, context.scope.storeId, input.id, input.data).catch(
          notFound,
        ),
      ),

    delete: can(permissions.SETTINGS_MANAGE)
      .input(z.object({ id: z.uuid() }))
      .handler(async ({ context, input }) => ({
        deleted: await deleteShippingProfile(context.tx, input.id),
      })),

    /** Products of the picked collections, for "Add a collection's products". */
    collectionProducts: can(permissions.SETTINGS_READ)
      .input(z.object({ collectionIds: z.array(z.uuid()).max(50) }))
      .handler(({ context, input }) => collectionProductIds(context.tx, input.collectionIds)),
  },

  zones: {
    list: can(permissions.SETTINGS_READ).handler(({ context }) => listShippingZones(context.tx)),

    get: can(permissions.SETTINGS_READ)
      .input(z.object({ id: z.uuid() }))
      .handler(({ context, input }) => getShippingZone(context.tx, input.id)),

    create: can(permissions.SETTINGS_MANAGE)
      .input(ShippingZoneWriteSchema)
      .handler(({ context, input }) =>
        createShippingZone(context.tx, context.scope.storeId, input),
      ),

    update: can(permissions.SETTINGS_MANAGE)
      .input(z.object({ id: z.uuid(), data: ShippingZoneWriteSchema }))
      .handler(({ context, input }) =>
        updateShippingZone(context.tx, context.scope.storeId, input.id, input.data).catch(notFound),
      ),

    delete: can(permissions.SETTINGS_MANAGE)
      .input(z.object({ id: z.uuid() }))
      .handler(async ({ context, input }) => ({
        deleted: await deleteShippingZone(context.tx, input.id),
      })),
  },
}
