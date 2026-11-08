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
  profileProductEntries,
  ShippingProfileWriteSchema,
  ShippingZoneWriteSchema,
  updateShippingProfile,
  updateShippingZone,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { BULK_MAX, can } from '../procedures'

const notFound = (err: unknown): never => {
  if (err instanceof CommerceError && err.code === 'NOT_FOUND') {
    throw new ORPCError('NOT_FOUND', { message: err.message })
  }
  throw err
}

type Zone = Awaited<ReturnType<typeof getShippingZone>>

/** What Settings → Activity log compares before and after a zone changes. */
function zoneFields(zone: Zone): Record<string, unknown> {
  if (!zone) return {}
  const { name, stateCodes, pincodeRules, rates } = zone
  // Rate rows are rewritten on every save: compare what they say, not their ids or times.
  const said = rates.map(
    ({ id: _id, zoneId: _zone, storeId: _store, createdAt: _c, updatedAt: _u, ...rate }) => rate,
  )
  return { name, stateCodes, pincodeRules, rates: said }
}

/**
 * Settings → Shipping → Shipping rates: shipping profiles (General and custom ones with
 * their products and variants), their zones (states and PIN code rules) and the rates offered in each.
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

    /**
     * Make a custom profile holding whole products (`productIds`, every variant including ones
     * added later) and single variants (`variantIds`, which win over their product's profile).
     */
    create: can(permissions.SETTINGS_MANAGE)
      .input(ShippingProfileWriteSchema)
      .handler(({ context, input }) =>
        createShippingProfile(context.tx, context.scope.storeId, input),
      ),

    /**
     * Rename a profile and set exactly its whole products and single variants (ones in another
     * profile move here; `variantIds` left out keeps the profile's variants as they are).
     */
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

    /**
     * Products with their variants as a profile's page lists them: which variants ship under
     * `profileId` and where the others ship now. For products just picked, before saving.
     */
    productEntries: can(permissions.SETTINGS_READ)
      .input(
        z.object({
          profileId: z.uuid().nullable(),
          productIds: z.array(z.uuid()).max(BULK_MAX),
        }),
      )
      .handler(({ context, input }) =>
        profileProductEntries(context.tx, input.profileId, input.productIds),
      ),

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
      .handler(async ({ context, input }) => {
        try {
          const before = await getShippingZone(context.tx, input.id)
          const after = await updateShippingZone(
            context.tx,
            context.scope.storeId,
            input.id,
            input.data,
          )
          context.activity.note({ before: zoneFields(before), after: zoneFields(after) })
          return after
        } catch (err) {
          if (err instanceof CommerceError && err.code === 'NOT_FOUND') {
            throw new ORPCError('NOT_FOUND', { message: err.message })
          }
          throw err
        }
      }),

    delete: can(permissions.SETTINGS_MANAGE)
      .input(z.object({ id: z.uuid() }))
      .handler(async ({ context, input }) => {
        const before = await getShippingZone(context.tx, input.id)
        const deleted = await deleteShippingZone(context.tx, input.id)
        if (deleted && before) {
          context.activity.note({ before: zoneFields(before), after: {}, label: before.name })
        } else context.activity.skip()
        return { deleted }
      }),
  },
}
