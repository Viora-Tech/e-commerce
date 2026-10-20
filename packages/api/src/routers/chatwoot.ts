import { loadEnv } from '@commerce/config'
import { permissions } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { CHATWOOT_ID, ChatwootSettingsPatchSchema } from '@commerce/plugin-chatwoot/settings'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { getStoreApps } from '../services/apps.service'
import {
  type ChatwootEnv,
  chatwootCustomerConversations,
  chatwootOrderConversations,
  getChatwootSettings,
  saveChatwootSettings,
  testChatwoot,
} from '../services/chatwoot.service'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

function chatwootEnv(): ChatwootEnv {
  const env = loadEnv(process.env)
  return { secret: env.SETTINGS_SECRET, trustedOrigins: env.CHATWOOT_TRUSTED_ORIGINS }
}

async function requireInstalled(context: Ctx) {
  const apps = await getStoreApps(context.tx, context.scope.storeId)
  if (!apps.installed.includes(CHATWOOT_ID)) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the Chatwoot app first' })
  }
}

/** The Chatwoot app: its settings page, and the Conversations cards on customers and orders. */
export const chatwootRouter = {
  settings: {
    get: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
      await requireInstalled(context)
      return getChatwootSettings(context.tx, context.scope.storeId)
    }),
    save: can(permissions.SETTINGS_MANAGE)
      .input(ChatwootSettingsPatchSchema)
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return saveChatwootSettings(context.tx, context.scope.storeId, input, chatwootEnv())
      }),
    /** Reads the profile and inboxes with the saved token; creates nothing. */
    test: can(permissions.SETTINGS_MANAGE).handler(async ({ context }) => {
      await requireInstalled(context)
      return testChatwoot(context.tx, context.scope.storeId, chatwootEnv())
    }),
  },
  /** A drawable state, never an error, so the rest of the page is unaffected. */
  conversations: {
    customer: can(permissions.CUSTOMERS_READ)
      .input(z.object({ customerId: z.uuid() }))
      .handler(({ context, input }) =>
        chatwootCustomerConversations(
          context.tx,
          context.scope.storeId,
          input.customerId,
          chatwootEnv(),
        ),
      ),
    order: can(permissions.ORDERS_READ)
      .input(z.object({ orderId: z.uuid() }))
      .handler(({ context, input }) =>
        chatwootOrderConversations(context.tx, context.scope.storeId, input.orderId, chatwootEnv()),
      ),
  },
}
