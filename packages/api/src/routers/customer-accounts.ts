import { loadEnv } from '@commerce/config'
import {
  availableLoginMethods,
  CustomerAccountSettingsSchema,
  LoginMethodUnavailable,
  loadCustomerAccountSettings,
  permissions,
  saveCustomerAccountSettings,
  unavailableLoginMethods,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { can } from '../procedures'
import { storeRegistries } from '../services/apps.service'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

const ctxOf = (context: Ctx) => ({ tx: context.tx, storeId: context.scope.storeId })

/** Sign-in methods the store's notification apps can deliver right now. */
async function available(context: Ctx) {
  const { notifications } = await storeRegistries(context.tx, context.scope.storeId)
  return availableLoginMethods(ctxOf(context), {
    registry: notifications,
    settingsSecret: loadEnv(process.env).SETTINGS_SECRET,
    // The console log channels reach nobody on a live store.
    allowDevChannels: process.env.NODE_ENV !== 'production',
  })
}

/** Settings → Customer accounts: guest checkout and sign-in methods. */
export const customerAccountsRouter = {
  get: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const settings = await loadCustomerAccountSettings(ctxOf(context))
    const methods = await available(context)
    return {
      settings,
      available: methods,
      /** Chosen methods whose app was switched off since; the page warns about them. */
      unavailable: unavailableLoginMethods(settings, methods),
    }
  }),

  save: can(permissions.SETTINGS_MANAGE)
    .input(CustomerAccountSettingsSchema)
    .handler(async ({ context, input }) => {
      try {
        return await saveCustomerAccountSettings(ctxOf(context), input, await available(context))
      } catch (error) {
        if (error instanceof LoginMethodUnavailable) {
          throw new ORPCError('BAD_REQUEST', { message: error.message })
        }
        throw error
      }
    }),
}
