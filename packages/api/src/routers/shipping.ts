import {
  CommerceError,
  createShippingZone,
  deleteShippingZone,
  getShippingZone,
  listShippingZones,
  permissions,
  ShippingZoneWriteSchema,
  updateShippingZone,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'

/**
 * Settings → Shipping → Shipping rates: zones (states and PIN code rules) and
 * the rates offered in each. Guarded like the rest of the shipping settings:
 * read with `settings.read`, change with `settings.manage`.
 */
export const shippingRouter = {
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
      .handler(async ({ context, input }) => {
        try {
          return await updateShippingZone(context.tx, context.scope.storeId, input.id, input.data)
        } catch (err) {
          if (err instanceof CommerceError && err.code === 'NOT_FOUND') {
            throw new ORPCError('NOT_FOUND', { message: err.message })
          }
          throw err
        }
      }),

    delete: can(permissions.SETTINGS_MANAGE)
      .input(z.object({ id: z.uuid() }))
      .handler(async ({ context, input }) => ({
        deleted: await deleteShippingZone(context.tx, input.id),
      })),
  },
}
