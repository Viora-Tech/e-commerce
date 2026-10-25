import {
  accessForApp,
  checkRateLimit,
  createMemoryRateLimitStore,
  permissions,
  rateLimitKey,
  retryAfterSeconds,
  storeAppAccess,
} from '@commerce/core'
import { appUninstallBlocker } from '@commerce/core/automations/server'
import { getRegistries } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { BULK_MAX, can } from '../procedures'
import {
  connectFormFor,
  saveAppConnection,
  testAppConnection,
} from '../services/app-connect.service'
import { disconnectStoreApp, installStoreApp, uninstallStoreApp } from '../services/apps.service'
import { storeAppSummaries } from '../services/installed-apps.service'
import { storeOrderActions } from '../services/order-actions.service'
import { TEST_CONNECTION_RULE } from '../services/shipping.service'

/** A plugin id as commerce.config.ts spells it. */
const PluginId = z.string().min(1).max(64)
const pluginId = z.object({ id: PluginId })

/** The account typed in the install flow's "Connect account" step. */
const ConnectInput = z.object({
  providerId: z.string().min(1).max(64),
  fields: z.record(z.string().max(64), z.string().max(4000)),
})

/** See `store.testDelhiveryConnection`: a store can't hammer a courier or gateway with guessed keys. */
const fallbackRateLimit = createMemoryRateLimitStore()

function requirePlugin(id: string) {
  const p = getRegistries().plugins.find((x) => x.id === id)
  if (!p) throw new ORPCError('NOT_FOUND', { message: `No plugin "${id}" in commerce.config.ts` })
  if (p.id === 'core') {
    throw new ORPCError('BAD_REQUEST', { message: 'The built-in plugin is always installed' })
  }
  return p
}

/** Some built-in apps stay while the store depends on them (Automations holds marketing). */
async function refuseBlockedUninstall(tx: StoreTx, storeId: string, pluginId: string) {
  const reason = await appUninstallBlocker(tx, storeId, pluginId)
  if (reason) throw new ORPCError('PRECONDITION_FAILED', { message: reason })
}

export const appsRouter = {
  /**
   * Every plugin this deployment ships, flagged with whether this store installed it, its
   * status (Connected, Needs setup, Error) and its history for the Installed apps list.
   */
  list: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const apps = await storeAppSummaries(context.tx, context.scope.storeId)
    // Paid apps: free, included in the plan, bought, or to buy (`@commerce/core/billing`).
    const pricing = await storeAppAccess(context.tx, context.scope.storeId)
    return apps.map((a) => ({ ...a, billing: pricing[a.id] ?? ({ state: 'free' } as const) }))
  }),

  /**
   * Actions installed apps add to orders (the order page's More actions, the Orders list's row
   * menu and bulk bar), grouped by app, limited to what this member may run. Needs only
   * `orders.read`, unlike `list`, so staff who work orders without settings access see them.
   */
  orderActions: can(permissions.ORDERS_READ).handler(({ context }) =>
    storeOrderActions(context.tx, context.scope.storeId, context.scope.can),
  ),

  /**
   * Install, optionally saving the account typed in the install flow's first step in the same
   * transaction, so an app is never left half connected.
   */
  install: can(permissions.APPS_MANAGE)
    .input(pluginId.extend({ connect: ConnectInput.optional() }))
    .handler(async ({ context, input }) => {
      requirePlugin(input.id)
      const { storeId, userId } = context.scope
      // A paid app the plan does not include must be bought first (Plan & billing pays for it).
      const access = await accessForApp(context.tx, storeId, input.id)
      if (access.state === 'buy') {
        throw new ORPCError('FORBIDDEN', {
          message: 'This app is not in your plan. Buy it, or move to a plan that includes it.',
          data: { reason: 'app_not_in_plan', ...access },
        })
      }
      const apps = await installStoreApp(context.tx, storeId, input.id, userId)
      if (input.connect) {
        await saveAppConnection(
          context.tx,
          storeId,
          input.id,
          input.connect.providerId,
          input.connect.fields,
        )
      }
      return apps
    }),

  uninstall: can(permissions.APPS_MANAGE)
    .input(pluginId)
    .handler(async ({ context, input }) => {
      requirePlugin(input.id)
      await refuseBlockedUninstall(context.tx, context.scope.storeId, input.id)
      return uninstallStoreApp(context.tx, context.scope.storeId, input.id)
    }),

  /** Bulk uninstall from the Installed apps list: all or none. */
  uninstallMany: can(permissions.APPS_MANAGE)
    .input(z.object({ ids: z.array(PluginId).min(1).max(BULK_MAX) }))
    .handler(async ({ context, input }) => {
      const ids = [...new Set(input.ids)]
      for (const id of ids) requirePlugin(id)
      for (const id of ids) await refuseBlockedUninstall(context.tx, context.scope.storeId, id)
      for (const id of ids) await uninstallStoreApp(context.tx, context.scope.storeId, id)
      return { removed: ids.length }
    }),

  /** Sign the app's account out: its providers switch off, the app stays installed (Needs setup). */
  disconnect: can(permissions.APPS_MANAGE)
    .input(pluginId)
    .handler(async ({ context, input }) => {
      requirePlugin(input.id)
      await disconnectStoreApp(context.tx, context.scope.storeId, input.id)
      return { ok: true }
    }),

  /** The fields of the install flow's "Connect account" step, or null when the app connects on its own page. */
  connectForm: can(permissions.APPS_MANAGE)
    .input(pluginId)
    .handler(({ input }) => connectFormFor(requirePlugin(input.id))),

  /** Read-only check of the account typed in the install flow. Rate limited per store. */
  testConnection: can(permissions.APPS_MANAGE)
    .input(pluginId.extend(ConnectInput.shape))
    .handler(async ({ context, input }) => {
      requirePlugin(input.id)
      const limit = await checkRateLimit(
        context.rateLimit ?? fallbackRateLimit,
        rateLimitKey('apps-test-connection', context.scope.storeId),
        TEST_CONNECTION_RULE,
      )
      if (!limit.ok) {
        throw new ORPCError('TOO_MANY_REQUESTS', {
          message: `Too many attempts. Try again in about ${Math.ceil(retryAfterSeconds(limit) / 60)} minute(s).`,
        })
      }
      return testAppConnection(
        context.tx,
        context.scope.storeId,
        input.id,
        input.providerId,
        input.fields,
      )
    }),
}
