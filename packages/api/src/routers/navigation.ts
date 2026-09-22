import {
  MenuItemsSchema,
  NavigationSettingsSchema,
  parseNavigationSettings,
  permissions,
} from '@commerce/core'
import { z } from 'zod'
import { can } from '../procedures'
import { deleteMenu, getMenu, listMenus, saveMenu } from '../services/navigation.service'
import { forgetNavigationHandle, getStore, updateStoreNavigation } from '../services/store.service'

const handle = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const navigationRouter = {
  list: can(permissions.ONLINE_STORE_READ).handler(({ context }) => listMenus(context.tx)),

  get: can(permissions.ONLINE_STORE_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getMenu(context.tx, input.id)),

  save: can(permissions.ONLINE_STORE_WRITE)
    .input(
      z.object({
        id: z.uuid().optional(),
        title: z.string().trim().min(1).max(120),
        handle,
        // Nested up to three levels, unique ids, bounded size: see MenuItemsSchema.
        items: MenuItemsSchema,
      }),
    )
    .handler(({ context, input }) => saveMenu(context.tx, context.scope.storeId, input)),

  delete: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const handle = await deleteMenu(context.tx, input.id)
      if (handle !== null) {
        await forgetNavigationHandle(context.tx, context.scope.storeId, handle)
      }
      return handle !== null
    }),

  /** Which menus the storefront header and footer render, by handle. */
  settings: can(permissions.ONLINE_STORE_READ).handler(async ({ context }) => {
    const s = await getStore(context.tx, context.scope.storeId)
    return parseNavigationSettings(s?.navigation)
  }),

  updateSettings: can(permissions.ONLINE_STORE_WRITE)
    .input(NavigationSettingsSchema)
    .handler(async ({ context, input }) => {
      const s = await updateStoreNavigation(context.tx, context.scope.storeId, input)
      return parseNavigationSettings(s?.navigation)
    }),
}
