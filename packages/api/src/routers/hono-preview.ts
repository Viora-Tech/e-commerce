import { settingsSecret } from '@commerce/config'
import { permissions, signHonoPreviewToken } from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { can } from '../procedures'

/**
 * Online store › Preferences › Faster product pages (beta): the owner's link that previews the
 * product pages drawn by the Bun + Hono service in their own browser while the store's switch
 * (`delivery.honoProduct`) is still off. The token becomes `wc_hono=on` for that browser alone
 * (`?hono=<token>` on the storefront), good for an hour. Store owner only; the switch itself is
 * saved through `store.updatePreferences`, which keeps it as stored for anyone else.
 */
export const honoPreviewRouter = {
  token: can(permissions.ONLINE_STORE_WRITE).handler(({ context }) => {
    if (!context.scope.isOwner) {
      throw new ORPCError('FORBIDDEN', { message: 'Only the store owner can preview this' })
    }
    return {
      token: signHonoPreviewToken({ secret: settingsSecret(), storeId: context.scope.storeId }),
    }
  }),
}
